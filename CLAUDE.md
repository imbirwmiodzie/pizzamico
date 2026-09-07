# Pizza Voice Timer — project context

A single-screen pizza timer steered by voice, built in Expo. This file is
context for whoever picks the project up next, human or otherwise.

## Where this came from

A designer handoff at `~/Downloads/design_handoff_pizza_voice_timer/` —
`README.md` (the spec), `Pizza Voice Timer.dc.html` (an interactive web
prototype), and `styles.css` (the "Classical" design-system tokens). **Those
three files are the source of truth for every colour, size and timing.** When
something here looks arbitrary, check them before changing it.

There is also a complete Kotlin/Jetpack Compose build of the same app at
`~/Downloads/pizza-voice-timer-android/`. This Expo project is a port of it,
and its `README.md` records the deviations from the handoff. Two prototype
bugs were fixed in both builds and should stay fixed:

- "restart" must reset, not start (the prototype's regex was unanchored).
- Setting a duration by voice re-arms the halfway turn (the prototype left
  `hasTurned` set, which could swallow the next "Gira!").

## Architecture

```
src/domain/     Pure TypeScript. No React, no Expo, no platform imports.
                timerEngine · bakeState · voiceCommands · toneCopy · settings
                All of it is unit-tested; treat it as the spec in code form.
src/state/      bakeStore (the one live bake) · useBake · useSettings
src/ui/         Screens and the Skia pizza
src/theme/      The design-system tokens, copied verbatim from styles.css
modules/pizza-bake-service/
                Local Expo module: Android foreground service + shouted TTS
                + the 880 Hz tick. iOS gets a no-op stub.
```

**The one rule that matters:** while a bake runs there is exactly one source
of truth, `endAt` — an absolute epoch timestamp. The native service fires the
audio cues from it; the UI derives the number on screen from it. Never add a
second countdown that decrements, and never let JS and native each keep their
own idea of "remaining" — that is how the shout and the display drift apart.

## Build and iterate

Free EAS accounts get 15 Android builds a month, so the CI is split:

- `.github/workflows/build.yml` — fires only on native changes (`app.json`,
  `package.json`, `plugins/`, `modules/`). Spends a build.
- `.github/workflows/update.yml` — every other push publishes an EAS Update
  over the air. Spends nothing.

Both run the unit tests and `tsc --noEmit` first. A native change means: new
or upgraded native dependency, changed permissions or plugins, edits to the
Kotlin module, or an SDK bump. Everything else — UI, timer rules, copy, voice
parsing — ships over the air to an already-installed APK.

Runtime versioning is on the `fingerprint` policy, so an update is only
delivered to a build whose native fingerprint matches. If you change native
code, the fingerprint changes and a rebuild is required; that is the signal,
not a guess.

## Commands

```bash
npm install          # first time, and after any dependency change
npx expo install --fix   # aligns dependency versions with the SDK — run once
npm test             # the domain unit tests
npm run lint         # tsc --noEmit
npx eas init         # fills the EAS project id placeholders in app.json
npx expo start --dev-client
```

## Conventions

- Type-only imports use `import type` — the Babel/Metro pipeline is
  isolatedModules, and it matters.
- Comments explain *why*, and cite the handoff when a number comes from it.
  Don't add comments that restate the code.
- Design tokens live in one place. No inline hex values in components.
