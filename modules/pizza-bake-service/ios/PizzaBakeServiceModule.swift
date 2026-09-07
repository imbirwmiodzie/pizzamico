import ExpoModulesCore

/**
 * iOS stand-in.
 *
 * iOS has no equivalent of an Android foreground service, and a suspended app
 * cannot speak. `isSupported` is false here, and the JS layer falls back to
 * scheduled local notifications for a backgrounded bake — while the app is on
 * screen the shouts come from `expo-speech` as usual.
 *
 * Kept as a real module rather than a missing one so `requireNativeModule`
 * resolves on both platforms and the JS never needs a platform check.
 */
public class PizzaBakeServiceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PizzaBakeService")

    Events("onBakeEvent")

    Property("isSupported") { () -> Bool in
      false
    }

    Function("startBake") { (_: [String: Any]) in
      // No-op: the JS layer schedules notifications on iOS.
    }

    Function("stopBake") {
      // No-op.
    }

    Function("shout") { (_: String, _: Double, _: Double) in
      // No-op: expo-speech handles foreground speech on iOS.
    }

    Function("tick") {
      // No-op: expo-audio handles the tick on iOS.
    }
  }
}
