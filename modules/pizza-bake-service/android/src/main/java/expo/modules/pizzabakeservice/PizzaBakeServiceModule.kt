package expo.modules.pizzabakeservice

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The JS-facing edge of the bake service.
 *
 * JavaScript hands over an absolute plan — when the bake ends, when to turn,
 * how often to tick, and what to shout — and native takes it from there. The
 * app can then be backgrounded, or its JS engine frozen, and the cues still
 * land on time.
 */
class PizzaBakeServiceModule : Module() {

    class BakePlan : Record {
        @Field val endAt: Double = 0.0
        @Field val totalSeconds: Int = 0
        @Field val turnAtRemaining: Int = -1
        @Field val tickEverySeconds: Int = 10
        @Field val turnLine: String = ""
        @Field val doneLine: String = ""
    }

    private val context: Context
        get() = requireNotNull(appContext.reactContext) { "React context is not available" }

    override fun definition() = ModuleDefinition {
        Name("PizzaBakeService")

        Events("onBakeEvent")

        Property("isSupported") { true }

        OnStartObserving {
            BakeForegroundService.Listener.onEvent = { event ->
                sendEvent("onBakeEvent", Bundle().apply { putString("event", event) })
            }
        }

        OnStopObserving {
            BakeForegroundService.Listener.onEvent = null
        }

        Function("startBake") { plan: BakePlan ->
            val data = BakePlanData(
                endAt = plan.endAt.toLong(),
                totalSeconds = plan.totalSeconds,
                turnAtRemaining = plan.turnAtRemaining,
                tickEverySeconds = plan.tickEverySeconds,
                turnLine = plan.turnLine,
                doneLine = plan.doneLine,
            )
            // startForegroundService arrived in API 26; before that, plain
            // startService followed by startForeground was the way, and the
            // service does the startForeground half either way.
            val intent = data.toIntent(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        Function("stopBake") {
            context.stopService(Intent(context, BakeForegroundService::class.java))
        }

        Function("shout") { text: String, pitch: Double, rate: Double ->
            PizzaVoice.get(context).shout(text, pitch.toFloat(), rate.toFloat())
        }

        Function("tick") {
            PizzaVoice.get(context).tick()
        }

        OnDestroy {
            BakeForegroundService.Listener.onEvent = null
        }
    }
}
