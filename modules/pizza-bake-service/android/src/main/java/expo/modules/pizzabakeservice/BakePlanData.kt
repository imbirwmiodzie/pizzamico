package expo.modules.pizzabakeservice

import android.content.Context
import android.content.Intent

/**
 * Everything the service needs to run a bake without asking JavaScript
 * anything, carried across the Intent boundary.
 */
data class BakePlanData(
    /** Epoch milliseconds at which the bake reaches zero. */
    val endAt: Long,
    val totalSeconds: Int,
    val turnAtRemaining: Int,
    val tickEverySeconds: Int,
    val turnLine: String,
    val doneLine: String,
) {
    fun toIntent(context: Context): Intent =
        Intent(context, BakeForegroundService::class.java).apply {
            putExtra(EXTRA_END_AT, endAt)
            putExtra(EXTRA_TOTAL, totalSeconds)
            putExtra(EXTRA_TURN_AT, turnAtRemaining)
            putExtra(EXTRA_TICK_EVERY, tickEverySeconds)
            putExtra(EXTRA_TURN_LINE, turnLine)
            putExtra(EXTRA_DONE_LINE, doneLine)
        }

    companion object {
        private const val EXTRA_END_AT = "endAt"
        private const val EXTRA_TOTAL = "totalSeconds"
        private const val EXTRA_TURN_AT = "turnAtRemaining"
        private const val EXTRA_TICK_EVERY = "tickEverySeconds"
        private const val EXTRA_TURN_LINE = "turnLine"
        private const val EXTRA_DONE_LINE = "doneLine"

        fun fromIntent(intent: Intent?): BakePlanData? {
            if (intent == null) return null
            val endAt = intent.getLongExtra(EXTRA_END_AT, 0L)
            if (endAt <= 0L) return null
            return BakePlanData(
                endAt = endAt,
                totalSeconds = intent.getIntExtra(EXTRA_TOTAL, 0),
                turnAtRemaining = intent.getIntExtra(EXTRA_TURN_AT, -1),
                tickEverySeconds = intent.getIntExtra(EXTRA_TICK_EVERY, 10),
                turnLine = intent.getStringExtra(EXTRA_TURN_LINE) ?: "",
                doneLine = intent.getStringExtra(EXTRA_DONE_LINE) ?: "",
            )
        }
    }
}
