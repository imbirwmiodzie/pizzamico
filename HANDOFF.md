# Handoff — what's built, what's left

Written for whoever continues this in Claude Code. Read `CLAUDE.md` first for
the architecture and the one rule about `endAt`.

## Status

**Done and verified**

| Area | Files | Notes |
|---|---|---|
| Project scaffolding | `package.json`, `app.json`, `eas.json`, `tsconfig.json`, `babel.config.js` | Expo SDK 57, RN 0.86. Dependency versions are best-known, not resolved — **run `npx expo install --fix` once** and commit the result. |
| CI | `.github/workflows/build.yml`, `update.yml` | Native changes build; everything else ships over the air. Both run tests + `tsc --noEmit` first. |
| Domain logic | `src/domain/*.ts` | Ported 1:1 from the Kotlin build. Pure, no platform imports. |
| Unit tests | `__tests__/*.test.ts` | 23 assertions covering the countdown and the parser. **They have never been run by Jest** — they were verified by executing the same expectations against the real TypeScript with `node --experimental-strip-types`, which passed 23/23. Run `npm test` first thing. |
| Native module | `modules/pizza-bake-service/**` | Android foreground service + shouted TTS + 880 Hz tick. iOS stub. Never compiled — expect to fix a Gradle detail or two. |
| State | `src/state/*.ts` | `bakeStore` owns the live bake; `useSettings` persists the three tweakables. |
| Design tokens | `src/theme/tokens.ts` | Verbatim from the handoff's `styles.css`. |

**Not built yet**

- `App.tsx` and `index.ts`'s target — the root component and the screen switch.
- `src/ui/PizzaIllustration.tsx` — the pizza and the flame ring, in Skia.
- `src/ui/TimerScreen.tsx`, `src/ui/SettingsScreen.tsx`.
- `src/ui/icons.tsx` — six line icons.
- `src/state/useVoice.ts` — the `expo-speech-recognition` wiring.
- `assets/icon.png` — app icon; `app.json` references it.

Nothing in this list is hard, and none of it needs a build to iterate on once
the first APK exists.

## Building the UI

The Kotlin implementation at `~/Downloads/pizza-voice-timer-android/` is a
working reference for every one of these. `app/src/main/java/com/ilforno/
pizzatimer/ui/` has the Compose versions of the same screens — the geometry
and animation maths port directly to Skia, which has the same drawing model
(`drawCircle`, `drawPath`, gradients, a canvas you paint each frame).

### The pizza — `PizzaIllustration.tsx`

Draw in the handoff's 200-unit viewbox and scale at the end; that way every
number below can be checked against the prototype one at a time.

- Crust `r=96`, cheese `r=80`, both centred at `(100, 100)`.
- Six topping positions: `(76,78) (122,72) (100,108) (68,122) (130,126) (96,148)`.
  Radius 8.5 for pepperoni, 6 for veggie, none for margherita.
- Ten herb flecks, `r=1.5`, always visible:
  `(60,60) (140,65) (82,168) (118,172) (55,100) (145,105) (70,40) (130,42) (100,172) (100,45)`.
- Eight char spots, revealed progressively:
  `(40,100,r4) (160,95,r3.5) (100,22,r4) (100,178,r3.5) (62,168,r3) (138,32,r3.5) (34,60,r3) (166,140,r3.5)`.
  Count = `round(max(0, progress - 0.45) / 0.55 * 8)`, opacity = `0.25 + progress * 0.35`.
- Colours interpolate channel-wise with `mixRgb` from `theme/tokens.ts`.
  Cheese uses `progress * 0.85` unless the timer hit zero, then a full 1.
- Toppings bob while running: `translateY -1.4`, `scale 1.05`, 2.4s loop,
  staggered 0.15s per topping.
- Fire ring while running: 14 flames on a circle at 54% of the pizza box,
  each an upright teardrop `h = 46 + (i%4)*14`, `w = 24 + (i%3)*8`, anchored
  at `translate(-50%, -38%)` of its own box, flickering on a
  `0.6 + (i%3)*0.18`s loop with delay `(i*0.11) % 1.2`. Keyframes:
  0% `(1, 1, α.92)` → 30% `(0.85, 1.3, α1)` → 60% `(1.12, 0.82, α.8)` → back.
  Gradient bottom→top: deep → orange 35% → amber 65% → pale 88% → transparent.
  Plus a soft radial orange glow behind the ring.
- Turn: rotate the pie 180° over 850ms, ease-in-out, then snap back to 0.
  Driven by `turnTrigger` from the store, which increments on every turn
  wherever it came from. **Do not rotate the flames.**
- Done: pulse `scale 1 ↔ 1.04` on a 1.6s loop, plus three rising steam wisps.

Two things the Compose version got right and are worth keeping:

1. **One clock, not fourteen.** Use a single Reanimated `useFrameCallback`
   (or one shared `SharedValue`) and compute each flame's phase
   analytically. Fourteen independent animations is a lot of scheduler churn
   for no visual gain.
2. **Size it so nothing clips.** The prototype's flames overflow their 196px
   box by design. Make the illustration a square box capped at 322dp with the
   196dp pie centred inside, and the whole fire ring fits with no clipping and
   no collision with the readout.

### The screens

`TimerScreen.kt` in the Kotlin project is the layout, spec by spec: header
with kicker + title + wake-lock toggle, centre zone with the pizza, the 80sp
readout (`accent700`, tabular figures) and the segmented preset picker, then
the 72dp mic with two pulse rings, the transport row (48 / 64 / 48), and the
"Try saying" chips. `SettingsScreen.kt` is the three tweakables.

Fonts are the easy win Expo gives you: `@expo-google-fonts/cormorant-garamond`
and `@expo-google-fonts/lora` are already dependencies, so load them with
`useFonts` and the handoff's real typefaces are there — no placeholder Serif,
unlike the Kotlin build.

Wake-lock is `expo-keep-awake`'s `useKeepAwake()` / `activateKeepAwakeAsync()`.

### Voice — `useVoice.ts`

`expo-speech-recognition`, with `interimResults: true`. Its `continuous: true`
only works on Android 13+, so keep the restart-on-end loop as a fallback —
`VoiceListener.kt` in the Kotlin project is that logic, including which errors
mean "just listen again" (`NO_MATCH`, `SPEECH_TIMEOUT`) versus which mean stop.

Feed every final transcript to `parseVoiceCommand` and dispatch to
`bakeActions`. The transcript line under the mic reads, in priority order:
`Hearing: "…"` → `✓ <confirmation>` (for 3 seconds) → `Listening…` → the
unsupported/denied message → `tone.micPrompt`.

## Before the first build

1. `npm install && npx expo install --fix` — then commit the corrected
   versions and the lockfile.
2. `npm test && npm run lint` — the tests have never actually run under Jest.
3. `npx eas init` — replaces the two `REPLACE_WITH_YOUR_EAS_PROJECT_ID`
   placeholders in `app.json`.
4. `./push.sh` — first push to GitHub.
5. Add `EXPO_TOKEN` to the repo's Actions secrets, then let the workflow build,
   or run `npx eas build -p android --profile preview` directly.

Expect the first native build to need a fix or two in
`modules/pizza-bake-service/android/build.gradle` — it was written without a
compiler to check it against.
