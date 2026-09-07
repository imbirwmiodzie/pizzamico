package expo.modules.pizzabakeservice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin

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

    @Volatile
    private var ready = false

    /** Queued while the engine is still starting up, so nothing is lost. */
    private var pending: Triple<String, Float, Float>? = null

    /** True when an Italian voice is installed; otherwise we shout in the default locale. */
    @Volatile
    var hasItalianVoice: Boolean = false
        private set

    init {
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

    /** A short 880 Hz blip — the every-10-seconds tick. */
    fun tick() {
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(TICK_PCM.size * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()

        track.write(TICK_PCM, 0, TICK_PCM.size)
        track.setNotificationMarkerPosition(TICK_PCM.size)
        track.setPlaybackPositionUpdateListener(
            object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(t: AudioTrack?) {
                    t?.release()
                }

                override fun onPeriodicNotification(t: AudioTrack?) = Unit
            },
        )
        track.play()
    }

    fun release() {
        abandonFocus()
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
        private const val SAMPLE_RATE = 44_100
        private const val TICK_MS = 150
        private const val TICK_HZ = 880.0
        private const val TICK_PEAK = 0.18

        @Volatile
        private var instance: PizzaVoice? = null

        fun get(context: Context): PizzaVoice =
            instance ?: synchronized(this) {
                instance ?: PizzaVoice(context).also { instance = it }
            }

        /**
         * 880 Hz sine with a 10 ms attack and an exponential decay to silence
         * by 150 ms — the envelope the web prototype builds with WebAudio.
         */
        private val TICK_PCM: ShortArray = ShortArray(SAMPLE_RATE * TICK_MS / 1000) { i ->
            val t = i.toDouble() / SAMPLE_RATE
            val attack = (t / 0.010).coerceAtMost(1.0)
            val decay = exp(-t / 0.045)
            val amplitude = TICK_PEAK * attack * decay
            (sin(2.0 * PI * TICK_HZ * t) * amplitude * Short.MAX_VALUE).toInt().toShort()
        }
    }
}
