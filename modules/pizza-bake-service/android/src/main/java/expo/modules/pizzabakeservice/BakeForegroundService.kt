package expo.modules.pizzabakeservice

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import kotlin.math.ceil

/**
 * Keeps a running bake alive when the app is not on screen.
 *
 * The service owns no countdown of its own: it is handed an absolute end
 * timestamp and works out what is left on every wake. That is what makes the
 * shout land on time whether the phone was awake, asleep, or somewhere in
 * between — a `remaining--` loop would have silently drifted.
 */
class BakeForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var plan: BakePlanData? = null
    private var lastRemaining = Int.MAX_VALUE
    private var turnFired = false

    private val heartbeat = object : Runnable {
        override fun run() {
            val current = plan ?: return
            val remaining = remainingSeconds(current.endAt)

            // Every whole second we cross, in order, so nothing is skipped
            // even if the system held us up.
            var second = (lastRemaining - 1).coerceAtMost(current.totalSeconds)
            while (second >= remaining && second >= 0) {
                fireCuesFor(second, current)
                second--
            }
            lastRemaining = remaining

            if (remaining <= 0) {
                stopSelfCleanly()
                return
            }

            notificationManager().notify(NOTIFICATION_ID, buildNotification(remaining))
            handler.postDelayed(this, nextBoundaryDelay(current.endAt))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
        // Warm the speech engine up now: the first line must not be the one
        // that arrives late because the engine was still starting.
        PizzaVoice.get(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val incoming = BakePlanData.fromIntent(intent)

        if (incoming == null) {
            // Started with no plan (a restart by the system) — nothing to count.
            stopSelfCleanly()
            return START_NOT_STICKY
        }

        plan = incoming
        lastRemaining = remainingSeconds(incoming.endAt)
        turnFired = remainingSeconds(incoming.endAt) <= incoming.turnAtRemaining

        startInForeground(remainingSeconds(incoming.endAt))
        handler.removeCallbacks(heartbeat)
        handler.post(heartbeat)
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    /* ── the cues ───────────────────────────────────────────────────────── */

    /** Turn, then tick, then done — the prototype's order. */
    private fun fireCuesFor(remaining: Int, current: BakePlanData) {
        val voice = PizzaVoice.get(this)

        if (!turnFired && remaining <= current.turnAtRemaining && remaining > 0) {
            turnFired = true
            voice.shout(current.turnLine, TURN_PITCH, TURN_RATE)
            Listener.emit("turn")
        }

        if (remaining > 0 &&
            current.tickEverySeconds > 0 &&
            remaining % current.tickEverySeconds == 0
        ) {
            voice.tick()
            Listener.emit("tick")
        }

        if (remaining == 0) {
            voice.shout(current.doneLine, DONE_PITCH, DONE_RATE)
            Listener.emit("done")
        }
    }

    private fun stopSelfCleanly() {
        handler.removeCallbacksAndMessages(null)
        plan = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /* ── notification ───────────────────────────────────────────────────── */

    private fun startInForeground(remaining: Int) {
        val notification = buildNotification(remaining)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(remaining: Int): android.app.Notification {
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val open = PendingIntent.getActivity(
            this,
            0,
            launch ?: Intent(),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val minutes = remaining / 60
        val seconds = remaining % 60
        val label = "$minutes:${seconds.toString().padStart(2, '0')}"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_bake)
            .setContentTitle("Pizza Timer")
            .setContentText("$label remaining")
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createChannel() {
        // Channels arrived in API 26; below that the notification's own
        // priority is the whole story.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Bake in progress",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Shows the countdown while a pizza is baking."
            setShowBadge(false)
        }
        notificationManager().createNotificationChannel(channel)
    }

    private fun notificationManager() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        const val CHANNEL_ID = "bake_progress"
        const val NOTIFICATION_ID = 41

        private const val TURN_PITCH = 0.65f
        private const val TURN_RATE = 1.35f
        private const val DONE_PITCH = 0.70f
        private const val DONE_RATE = 1.20f

        /** Seconds left, rounded up, so 0 means "the bake is over". */
        fun remainingSeconds(endAt: Long): Int {
            val millis = endAt - System.currentTimeMillis()
            if (millis <= 0) return 0
            return ceil(millis / 1000.0).toInt()
        }

        /** Wake just after the next whole-second boundary, not every 1000ms. */
        private fun nextBoundaryDelay(endAt: Long): Long {
            val millis = endAt - System.currentTimeMillis()
            val intoSecond = millis % 1000L
            return if (intoSecond <= 0L) 1000L else intoSecond
        }

        /** How the module hears about cues, so the pizza can flip on screen. */
        object Listener {
            @Volatile
            var onEvent: ((String) -> Unit)? = null

            fun emit(event: String) {
                onEvent?.invoke(event)
            }
        }
    }
}
