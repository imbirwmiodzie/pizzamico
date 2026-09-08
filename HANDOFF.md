# Handoff — what's built, what's left

Written for whoever continues this in Claude Code. Read `CLAUDE.md` first for
the architecture and the one rule about `endAt`.

## Status

The app is complete in JavaScript. It type-checks, its domain tests pass, and
it bundles for Android. What it has never done is run on a device — no APK has
been built yet, and the Kotlin module has never been through a compiler.

**Done and verified**

| Area | Files | Notes |
|---|---|---|
| Project scaffolding | `package.json`, `app.json`, `eas.json`, `tsconfig.json`, `babel.config.js` | Expo SDK 57, RN 0.86.3. Versions now match the SDK — see "Dependency versions" below. |
| CI | `.github/workflows/checks.yml`, `.eas/workflows/*.yml` | GitHub runs tests + `tsc --noEmit` on every push, no secrets needed. EAS runs the build (manual) and the over-the-air update (on push). |
| Domain logic | `src/domain/*.ts` | Ported 1:1 from the Kotlin build. Pure, no platform imports. |
| Unit tests | `__tests__/*.test.ts` | 31 tests over the countdown, the parser and the mic's status line. `npm test` — green. |
| Native module | `modules/pizza-bake-service/**` | Android foreground service + shouted TTS + 880 Hz tick. iOS stub. **Never compiled**, but reviewed against SDK 57 — see "The native module" below. |
| State | `src/state/*.ts` | `bakeStore` owns the live bake; `useSettings` persists the three tweakables; `useVoice` runs the microphone. |
| Screens | `App.tsx`, `src/ui/*.tsx` | Timer screen, settings, the Skia pizza, the six line icons. |
| Design tokens | `src/theme/tokens.ts` | Verbatim from the handoff's `styles.css`, plus the two font families and the type scale. |
| App icon | `assets/icon.png`, `scripts/make-icon.mjs` | Generated from the same tokens the app draws with; re-run `node scripts/make-icon.mjs` if they change. |

**Checked here**

```
npm test                     31 passed
npm run lint                 clean
npx expo export --platform android    bundles, 3.1MB + 6 font files
```

**Not verified — needs a device**

- The foreground service, the shout, and the 880 Hz tick. All of it is Kotlin
  that has never been compiled.
- Whether the halfway "GIRA!" really lands on time with the app backgrounded.
  That is the whole point of the `endAt` design, and it is the one thing a
  bundler cannot tell you.
- Speech recognition: permissions, the restart-on-end loop, and whether
  `continuous: true` behaves on the test device's Android version.
- The pizza's fire ring at real pixel densities. The geometry is right on
  paper — the ring sits at 105.8dp from the centre against a 94dp crust, well
  inside the 322dp box — but nobody has looked at it.

## The native module

Read against the installed SDK 57 sources rather than compiled, so this is
review, not proof. Four things were wrong and are fixed:

- `android/build.gradle` called `getKotlinVersion()`, which SDK 57's
  `ExpoModulesCorePlugin.gradle` no longer defines — configuration would have
  failed outright. It now uses the `expo-module-gradle-plugin` shape every
  bundled module uses, which also stops `compileSdk` drifting from the app's.
- `startForegroundService`, `NotificationChannel` and `AudioFocusRequest` are
  all API 26, and `minSdkVersion` is 24. Each is guarded now; the pre-26 paths
  are the ones those APIs replaced, so old devices degrade rather than crash.
- `expo-updates` was never installed, so the `updates.url` and the fingerprint
  `runtimeVersion` in `app.json` pointed at machinery that was not in the app.
  The whole over-the-air half of the CI would have failed on the first push.
  It is now a dependency.

The DSL the module uses — `Events`, `OnStartObserving`, `OnStopObserving`,
`Property(name) { }`, `Function`, `Record`/`@Field` — was checked against
`expo-modules-core`'s Kotlin sources and all of it exists in SDK 57.

What is still unproven is everything a compiler would tell you: the Kotlin
itself, the manifest merge, and the `<property>` element on the special-use
service.

## Dependency versions

`npx expo install --fix` could not reach `api.expo.dev` from the machine this
was continued on, so the versions were pinned by hand from
`node_modules/expo/bundledNativeModules.json` — the same list the command
reads. **Run `npx expo install --fix` once from a machine with network** to
confirm; it should report nothing to change.

Three version notes worth keeping:

- TypeScript 6 stopped including every `@types/*` package automatically, so
  `tsconfig.json` names `jest` and `node` explicitly. Without that the test
  files stop compiling — `describe` and `expect` become undefined names — and
  both `npm test` and `npm run lint` fail while the app code is fine.

- `@shopify/react-native-skia` is pinned to the SDK's `2.6.2`. The original
  `^2.2.12` floated up to 2.11, which wants `react-native-worklets >= 0.7`
  while the SDK ships 0.10.1 through Reanimated — the install failed outright.
- `babel-preset-expo` is an explicit devDependency. npm nests it under `expo`,
  and `babel.config.js` resolves it from the project root, so without it Metro
  fails to construct a transformer before it reads a single file.

## Getting an APK

The EAS project id is committed, and expo.dev is connected to this repo, so a
build is a button:

1. expo.dev → the project → **Workflows** → **Build Android preview** → Run.
2. Pick the branch. The `preview` profile builds an APK with internal
   distribution, so what comes back is a link you can install from the phone.

From a machine instead: `npm i -g eas-cli && eas login && eas workflow:run
.eas/workflows/build-android.yml`, or `eas build -p android --profile preview`.

Two mechanisms were considered and one was dropped. GitHub Actions can drive
EAS too, with an `EXPO_TOKEN` secret — that is what the workflows here did at
first. Once expo.dev's own GitHub integration was in play, keeping both meant
every push would publish its update twice the moment that secret existed. So
GitHub does the checks, EAS does the builds and the updates, and neither
overlaps the other.

Note that `.eas/workflows/build-android.yml` has **no `on:` trigger**. That is
deliberate — fifteen builds a month is not enough for a build to be a side
effect of pushing. Updates are free and stay automatic.

## If the UI needs changing

Everything in `src/ui/` ships over the air, so iterate against an installed
APK rather than rebuilding. The numbers all come from the designer handoff at
`~/Downloads/design_handoff_pizza_voice_timer/`; where a value looks arbitrary,
it is quoted in a comment next to it.

The pizza is the one file worth reading before editing. It draws in the
handoff's 200-unit viewbox and scales once at the end, and every moving part —
fourteen flames, six toppings, three steam wisps — reads its phase off a single
frame callback that stops whenever nothing is moving. Adding a second clock is
the easy way to make it stutter.
