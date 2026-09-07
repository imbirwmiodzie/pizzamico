import { NativeModule, requireNativeModule } from 'expo';

/**
 * The bake's clock and its voice, living in native code.
 *
 * Why this module exists: JavaScript stops running when Android freezes the
 * app, so a JS-side countdown cannot be trusted to shout "GIRA!" at the
 * halfway mark while the phone is in a pocket. So the cues are handed to a
 * foreground service, which keeps the process alive and fires them from
 * absolute timestamps.
 *
 * The split of duties:
 *   native — the notification, the audio cues (tick / turn / done), staying alive
 *   JS     — everything you can see
 *
 * Both derive the countdown from the same `endAt` timestamp, so the number on
 * screen and the moment the shout lands can never drift apart.
 */

export type BakePlan = {
  /** Epoch milliseconds at which the bake reaches zero. */
  endAt: number;
  /** The full duration, for the notification and for progress. */
  totalSeconds: number;
  /** Fire the turn when the countdown reaches this many seconds remaining. */
  turnAtRemaining: number;
  /** Tick whenever remaining is a multiple of this and above zero. */
  tickEverySeconds: number;
  /** The shouted line for the halfway turn. */
  turnLine: string;
  /** The shouted line at zero. */
  doneLine: string;
};

export type BakeEventPayload = { event: 'turn' | 'done' | 'tick' };

declare class PizzaBakeServiceModuleType extends NativeModule<{
  onBakeEvent: (payload: BakeEventPayload) => void;
}> {
  /** True when the platform can run the background service at all (Android only). */
  readonly isSupported: boolean;

  /** Start (or re-arm) the foreground service for this plan. */
  startBake(plan: BakePlan): void;

  /** Stop the service and its notification. Safe to call when not running. */
  stopBake(): void;

  /** Say something in Italian, loudly. Used for a "gira" asked for by hand. */
  shout(text: string, pitch: number, rate: number): void;

  /** The 10-second blip, for when JS wants one outside a running bake. */
  tick(): void;
};

export default requireNativeModule<PizzaBakeServiceModuleType>('PizzaBakeService');
