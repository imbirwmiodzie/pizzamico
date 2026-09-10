package expo.modules.pizzabakeservice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * The app's mouth: the shouted Italian lines and the 10-second tick.
 *
 * The handoff is explicit that the two Italian lines are *shouted* — low
 * pitch, fast rate, full volume — not read out in a calm assistant voice.
 *
 * One instance per process, created lazily and kept warm: a TextToSpeech
 * engine takes a moment to initialise, and the first "GIRA!" must not be the
 * one that gets swallowed.
 */
class PizzaVoice private constructor(context: Context) {

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private val speechAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    private var focusRequest: AudioFocusRequest? = null
    private var tts: TextToSpeech? = null

    private val soundPool: SoundPool = SoundPool.Builder()
        .setMaxStreams(2)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()

    private var tickSoundId = 0

    @Volatile
    private var tickLoaded = false

    @Volatile
    private var ready = false

    /** Queued while the engine is still starting up, so nothing is lost. */
    private var pending: Triple<String, Float, Float>? = null

    /** True when an Italian voice is installed; otherwise we shout in the default locale. */
    @Volatile
    var hasItalianVoice: Boolean = false
        private set

    init {
        soundPool.setOnLoadCompleteListener { _, _, status ->
            tickLoaded = status == 0
        }
        tickSoundId = soundPool.load(appContext, R.raw.tick, 1)

        tts = TextToSpeech(appContext) { status ->
            if (status != TextToSpeech.SUCCESS) return@TextToSpeech
            val engine = tts ?: return@TextToSpeech
            val result = engine.setLanguage(Locale.ITALIAN)
            hasItalianVoice = result != TextToSpeech.LANG_MISSING_DATA &&
                result != TextToSpeech.LANG_NOT_SUPPORTED
            if (!hasItalianVoice) engine.language = Locale.getDefault()
            engine.setAudioAttributes(speechAttributes)
            engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) = Unit
                override fun onDone(utteranceId: String?) = abandonFocus()
                @Deprecated("Required by the platform base class")
                override fun onError(utteranceId: String?) = abandonFocus()
                override fun onError(utteranceId: String?, errorCode: Int) = abandonFocus()
            })
            ready = true
            pending?.let { (text, pitch, rate) ->
                pending = null
                shout(text, pitch, rate)
            }
        }
    }

    /**
     * Shout a line. If the engine is still waking up the line is held and
     * spoken the moment it is ready, rather than dropped.
     */
    fun shout(text: String, pitch: Float, rate: Float) {
        val engine = tts
        if (engine == null || !ready) {
            pending = Triple(text, pitch, rate)
            return
        }
        requestFocus()
        engine.setPitch(pitch)
        engine.setSpeechRate(rate)
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f) }
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, text.hashCode().toString())
    }

    /**
     * The ten-second blip.
     *
     * SoundPool rather than a synthesised AudioTrack: the file is decoded
     * once at startup and every tick after that is just playback — no
     * allocation, no resampling, and none of the artefacts that came of
     * building a waveform by hand at the wrong sample rate. The sound itself
     * is rendered by `scripts/make-tick.mjs`, where it can be designed with
     * an envelope that reaches silence and partials a phone speaker can
     * actually reproduce.
     */
    fun tick() {
        val id = tickSoundId
        if (id == 0 || !tickLoaded) return
        soundPool.play(id, TICK_VOLUME, TICK_VOLUME, 1, 0, 1.0f)
    }

    fun release() {
        abandonFocus()
        soundPool.release()
        tts?.stop()
        tts?.shutdown()
        tts = null
        ready = false
    }

    /**
     * Duck whatever music is playing for the length of the shout.
     *
     * AudioFocusRequest is API 26. On older devices the shout simply plays
     * over the top rather than ducking — worth losing, since the alternative
     * is the deprecated focus API for a sliver of devices.
     */
    private fun requestFocus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(speechAttributes)
            .build()
        focusRequest = request
        audioManager.requestAudioFocus(request)
    }

    private fun abandonFocus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
        focusRequest = null
    }

    companion object {
        /** Full scale; the file itself is mastered to a sensible level. */
        private const val TICK_VOLUME = 1.0f

        @Volatile
        private var instance: PizzaVoice? = null

        fun get(context: Context): PizzaVoice =
            instance ?: synchronized(this) {
                instance ?: PizzaVoice(context).also { instance = it }
            }

    }
}
