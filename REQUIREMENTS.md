# Pizza Voice Timer — requirements

This is a clean-room spec: what the app must *do* and *look like*, extracted
from the shipped domain logic, the design references supplied during
development, and the product decisions made along the way. It does not
describe how the current code is built — read it without opening `src/` and
you should be able to rebuild the product from scratch.

`CLAUDE.md` and `HANDOFF.md` describe the *existing* implementation (its file
layout, its build pipeline, its known rough edges) and are worth keeping for
that reason. This file is the "what," not the "how."

---

## 1. What the app is

A single-screen kitchen timer for baking pizza, controlled by voice or by
touch. It sits face-up on a counter or is tucked in a pocket while an oven
runs; the app has to keep working — and keep shouting the right thing at the
right moment — even while backgrounded.

Two things make it more than a generic countdown:

- **A halfway "turn the pizza" cue.** Left in a wood oven too long on one
  side, a pizza burns unevenly. At the halfway point of a bake (not a
  preheat), the app shouts "GIRA! GIRA GIRA!" (Italian for "turn!") and shows
  a "Gira, gira! 🍕" toast, so the cue reads even with the sound off.
- **Voice control.** "Start", "pause", "reset", "three minutes", "gira" —
  spoken commands work hands-free, because hands are usually covered in
  flour or holding a hot peel.

## 2. Visual design — target reference

The current visual target is a photo the product owner supplied directly
(not a design tool export). It is the source of truth for layout, color, and
copy on the main screen. Screenshots from three iterations of trying to match
it are the best available description of what "close enough" and "not close
enough" look like — treat any of them as ground truth over a paraphrase
below.

### 2.1 Screen structure, top to bottom

1. **Header.** Wordmark **"PIZZAORO"** at the left, set in a bold serif
   (the reference uses something in the Cormorant Garamond / classical-serif
   family), dark warm brown/near-black. A plain outline microphone glyph
   sits at the right edge of the same row — small, no background circle, no
   label. Tapping it toggles voice listening.
2. **Preset pills.** A row of pill-shaped buttons, one per duration preset,
   evenly spaced, filling the width. Each pill is a solid warm color running
   light-amber → orange → red left to right (see §2.2), white bold text,
   fully rounded ends. The reference shows three: `60s`, `90s`, `120s`.
3. **The pizza clock.** A large circular illustration — noticeably big,
   close to the width of the screen — split into two halves along a
   diagonal line (roughly 11 o'clock to 5 o'clock, not a plumb vertical or
   horizontal cut): one half a photographically baked pizza (crust char,
   melted cheese, pepperoni, basil), the other half plain raw dough. Over
   the whole circle sits a working clock face: tick marks at all twelve
   hours, numerals at 12/3/6/9, and two hands (hour + minute) in a dark
   brown that reads against both the pizza and the dough.
4. **The ring readout**, directly below and *overlapping* the pizza's
   bottom edge (the pizza visually sits in front of, and above, the top of
   the circle — they are not stacked with a gap). A large circle filled
   with a warm coral→red gradient, a soft lighter halo/track just outside
   its rim, and a subtle brighter arc along part of the rim that reads as
   progress. Centered inside: the countdown in large bold white numerals
   (`M:SS`, e.g. `1:30`), and below that, smaller, the static caption
   **"SEKUND"** (Polish for "seconds") in uppercase, letter-spaced, a
   lighter/translucent white.
5. **Info line**, centered, two fields separated by a gap, regular-weight
   label + bold value, small and muted:
   `W piecu od: 0:14` (Polish, "in the oven since") and `Pizza: Margherita`.
   These read live values — elapsed time in the current bake, and the
   selected topping — not hardcoded text.
6. **Bottom bar.** A dark, near-black bar spanning the width, flush with
   the bottom of the screen (rounded top corners), holding exactly two
   icons with generous spacing: a stopwatch/timer glyph on the left (marks
   "you are on the timer screen") and a settings gear on the right (opens
   the settings screen). No labels, no third icon.

### 2.2 Color palette

Extracted from the reference photo by eye (no design-token export exists for
it — these are the values to start from, not to treat as unchangeable):

| Role | Value |
|---|---|
| Screen background | warm off-white cream, `#f7f1e6` |
| Header wordmark / body text | near-black warm brown, `#2c2018` |
| Muted/secondary text | warm taupe, `#8a7a6c` |
| Preset pill 1 (leftmost) | light amber, `rgb(242, 163, 60)` |
| Preset pill 2 (middle) | mixes toward the last pill, e.g. deep orange |
| Preset pill 3 (rightmost) | red, `rgb(216, 74, 54)` |
| Ring readout gradient | coral `#ef7a5c` → deep red `#c8402d` |
| Ring track / halo | translucent white, ~32% opacity |
| Ring progress arc | translucent white, ~90% opacity |
| Bottom bar | near-black warm brown, `#2a211c` |
| Bottom bar icon (active) | warm off-white, `#f3ece3` |
| Bottom bar icon (inactive) | the same, dimmed to ~40% opacity |

Mix intermediate preset-pill colors on a straight RGB ramp between the first
and last rather than hand-picking each one, so the row scales cleanly to
however many presets a given oven mode offers (see §3.3).

### 2.3 Typography

- **Display/wordmark**: a classical serif, semibold weight (the shipped app
  used Cormorant Garamond).
- **Body text and the countdown itself**: a text serif, regular and
  semibold weights (the shipped app used Lora — deliberately *not* the
  display serif for the countdown, because thin display strokes are hard to
  read at a glance from across a kitchen).
- Countdown digits use tabular/monospaced figures so the seconds ticking
  over never shifts the minutes sideways.

### 2.4 What's in the photo that the app still needs to solve for

The reference is a single static photo. Two things it shows that the app has
to handle dynamically, and one gap it leaves open:

- **The clock hands must move.** They should read bake progress, not
  wall-clock time: e.g. the minute hand sweeps once across the whole bake,
  the hour hand creeps at a twelfth of that rate (matching a real clock's
  ratio) — so a glance at the pizza tells you roughly how far along it is
  without reading the number.
- **The baked/dough split is presumably static** (the photo shows a
  finished-looking pizza on one side regardless of state) rather than
  something that changes as the bake progresses. Decide deliberately whether
  the "baked" half always looks fully baked, or whether it should still
  reflect char/doneness building up over the bake the way the previous
  procedural illustration did — the photo alone doesn't answer this.
- **The photo shows no visible reset/start/pause controls at all** —
  presumably voice is meant to be the only control surface. The product
  decision made during development was to keep small, deliberately
  understated manual controls (a reset button and a play/pause button)
  since voice recognition can fail or be unavailable and a kitchen timer
  needs a manual fallback. Where exactly those controls live visually is
  open — a slim row above the bottom bar is one option, not a mandate.

### 2.5 Pizza/dough artwork — open dependency

The reference's pizza and dough are photographs, not illustrations. Rendering
the clock as procedurally-drawn shapes (colored circles for crust/cheese/
toppings) reads as a cartoon next to it and was explicitly rejected as "not
matching." To build this for real:

- **Source two photographs**: a baked pizza (matching the reference's
  framing/crop — a close, roughly top-down, circular composition with
  visible char, cheese, and toppings) and raw dough shot in the same
  framing/lighting, so the two halves read as one continuous object once
  composited along the split line.
- Composite them with the tilted split mask and the clock overlay (ticks,
  numerals, hands) on top.
- Nobody generated or sourced these images yet — this is a blocking asset
  dependency, not a coding task, until real photo files exist.

## 3. Functional requirements

### 3.1 The countdown

- A bake has a **preset duration** in seconds and a **remaining** count in
  seconds, plus running/paused/done state.
- **Single source of truth while running**: derive the displayed remaining
  time from one absolute end timestamp (`now + duration`), not from a
  decrementing counter. Anything that fires cues (a background service, the
  UI) must compute off that same timestamp, or the audio cue and the number
  on screen can drift apart under backgrounding, doze, or a slow frame.
- Ticks at whole seconds. A repeating short audio "blip" fires every 10
  seconds of remaining time (configurable interval), while remaining > 0.
- **Halfway turn cue**: once, per bake, when remaining time first reaches
  ≤ half the preset duration — *and only for an actual bake, never for a
  preheat* (see §3.2) — fire the turn cue: shout "GIRA! GIRA GIRA!" (Italian,
  low pitch ~0.65, fast rate ~1.35) and show an on-screen toast ("Gira,
  gira! 🍕") for a few seconds (reference: 2.6s).
- **Done cue**: when remaining reaches 0, stop the run and shout the
  appropriate line (see §3.2), at pitch ~0.7, rate ~1.2.
- **Play/pause**: pressing play while stopped at zero restarts the full
  preset duration from the top (and re-arms the halfway cue). Pressing pause
  simply stops the countdown where it is; pressing play again resumes from
  wherever it left off (no re-arm).
- **Reset**: returns to the top of the currently selected preset, stopped,
  and re-arms the halfway cue.
- **Bug to not reintroduce**: an earlier prototype's "restart" action would
  incorrectly *start* the timer instead of resetting it (an unanchored
  regex matched "start" inside "restart"). Keep restart/reset unambiguous.
- **Bug to not reintroduce**: setting a new duration by voice mid-bake must
  clear the "already turned" flag, or the halfway cue for the new duration
  can be silently swallowed because the old bake already used its one turn.

### 3.2 Oven presets and preheat

- Duration presets are grouped by **oven type** — at least a "home oven" and
  a "wood-fired oven" profile, each offering a different set of preset
  durations. Only one set is shown at a time, chosen in settings.
- Any preset duration of **30 minutes or more counts as a preheat**, not a
  bake: nothing survives half an hour in a pizza oven, so a duration that
  long means the oven itself is warming up.
- Preheat mode changes behavior, not just labeling:
  - No halfway turn cue (there's no pizza in the oven yet to turn).
  - A different "done" line, appropriate to the oven being ready rather
    than the pizza ("IL FORNO È PRONTO!" — "the oven is ready!" — vs. "LA
    PIZZA È PRONTA!!!" for a real bake).
  - Different status copy while running/done ("Heating the oven…" / "Oven
    is ready!" vs. "Baking…" / done copy).
  - Consider whether the illustration itself should change for preheat
    (the shipped app swapped the pizza clock for a drawing of the oven
    interior with visible heating elements) — worth deciding deliberately
    for a rebuild rather than carrying it over by default.
- Switching oven type while nothing is running should snap the selected
  duration onto one this oven actually offers (prefer a bake duration over
  a preheat, so switching ovens never silently arms a 30-minute preheat
  the person didn't ask for). Switching while running should not be
  possible from the UI (presets are disabled while a bake is in progress).

### 3.3 Presets shown in the UI

The reference photo shows three pills reading `60s`, `90s`, `120s`. Whether
that's meant literally (i.e., the "home oven" preset list should be
`[60, 90, 120]` seconds with no preheat option at all) or whether it's
showing a subset and the real preset list should still include a ~30-minute
preheat option is **not resolved** — decide this deliberately rather than
inheriting whatever list the previous implementation happened to use
(`[60, 90, 1800]` for home, `[45, 60, 90, 1800]` for wood-fired). Whatever is
chosen, format each pill's label as `"{n}s"` under two minutes and
`"{n} min"` at two minutes or longer (matches the reference's own labels and
reads better than e.g. `"1800s"`).

### 3.4 Settings

Three tweakables, persisted across launches:

1. **Topping style** — at minimum `pepperoni`, `margherita`, `veggie`.
   Affects what's drawn/composited on the pizza (toppings present or not,
   which topping) and is reflected in the "Pizza: …" info-line value.
2. **Voice tone** — `casual` or `formal`. Changes the English status copy and
   the mic hint text throughout the app (see the copy table in §4.4); the
   shouted Italian lines never change with tone.
3. **Oven type** — which preset-duration list is active (§3.2–3.3).

Persist to on-device storage; on load, fall back to sane defaults if the
stored value is missing, corrupt, or names an option that no longer exists,
rather than crashing.

## 4. Voice control

### 4.1 Requirements

- A microphone toggle starts/stops continuous listening.
- While listening, show interim ("hearing") text as it arrives, and after a
  final result, show a brief confirmation of what was understood and done
  (a few seconds, then fades — reference: 3s).
- Recognition errors that just mean "nothing was heard" (no speech, timeout,
  busy) should silently restart listening, not surface as an error or stop
  listening. Only real failures (permission denied, no recognizer available,
  network required and unavailable, etc.) should stop listening and show a
  message.
- Since some Android versions don't honor a "keep listening continuously"
  flag, the recognizer may end after every utterance even when it's meant to
  keep listening — detect that and silently restart it, with a brief pause
  (reference: 250ms) so an instantly-failing recognizer can't spin in a
  tight loop.
- Bias recognition toward the app's own vocabulary if the platform supports
  it (contextual hints: "gira", "minutes", "seconds", "start", "pause",
  "reset").

### 4.2 Command grammar

Case-insensitive, checked in this priority order so an utterance containing
both a duration and an action word resolves predictably (e.g. "start a
3-minute bake" sets the duration, it doesn't start the current one):

1. **Set duration** — a number followed by a unit word (`minute(s)`,
   `min(s)`, `second(s)`, `sec(s)`). The number may be digits ("3") or
   spelled out, including compounds ("forty five", "ninety"). Reject/ignore
   anything resolving to more than 2 hours (guards against a misheard large
   number). Setting a duration this way is accepted **even mid-bake** —
   unlike tapping a preset pill, which is ignored while running — and stops
   the current run, arming the new duration fresh (turn cue re-armed).
2. **Start** — any of: start, begin, resume, go, commence.
3. **Pause** — any of: pause, stop, hold, suspend.
4. **Reset** — any of: reset, restart. (See the restart/reset bug note in
   §3.1 — these must never behave like "start.")
5. **Turn** — "gira". Requests the turn cue by hand, independent of the
   halfway auto-trigger (shouts the turn line and fires the toast/clock
   reaction immediately).

An utterance matching none of these is silently ignored (no error surfaced
for ordinary background chatter).

### 4.3 Command confirmations

After acting on a command, show a brief confirmation matching the tone
setting: e.g. "Started timer" / "Commenced bake" for start, and so on for
pause/reset. For a spoken duration, confirm using the number *as spoken*,
not as stored — "three minutes" confirms as "Set to 3 minutes", never
"Set to 180 seconds".

### 4.4 Tone copy reference

Two tone sets, both used verbatim in the shipped app; reuse or replace them
deliberately, but this is the copy contract other requirements above assume
exists:

| Key | Casual | Formal |
|---|---|---|
| ready | Ready to bake | Standing by |
| baking | Baking… | Bake in progress |
| preheating | Heating the oven… | Preheat in progress |
| preheated | Oven is ready! | Oven at temperature |
| paused | Paused | Bake paused |
| done | La pizza è pronta!!! | La pizza è pronta!!! |
| mic prompt | Tap to speak, or say "Hey timer, start" | Tap to speak, or say "Timer, commence" |
| start confirmation | Started timer | Commenced bake |
| pause confirmation | Paused timer | Suspended bake |
| reset confirmation | Reset timer | Bake reset |

Shouted Italian lines (both tones, unaffected by the tone setting):

- Turn: **GIRA! GIRA GIRA!**
- Done (bake): **LA PIZZA È PRONTA!!!**
- Done (preheat): **IL FORNO È PRONTO!**

## 5. Reliability requirements (why this isn't just a JS countdown)

- The app must keep counting down, and fire the halfway/done audio cues at
  the correct moment, **even when backgrounded** (screen off, phone in a
  pocket, JS execution possibly suspended by the OS). On Android this
  requires a foreground service with its own notification — a plain JS
  `setInterval` cannot be trusted to survive backgrounding.
- Both the visible countdown and the background audio cues must derive from
  the *same* absolute end timestamp. Never let the UI and the background
  mechanism keep independent decrementing counters — that's how the shout
  and the on-screen number end up disagreeing.
- On platforms without an equivalent background mechanism (iOS, or an
  Android device where the service can't run), fall back to firing cues
  from JS on a display-refresh timer while the app is foregrounded, and
  accept that background reliability is reduced there — make this an
  explicit, visible platform difference, not a silent one.
- A notification (or platform equivalent) should reflect that a bake is
  running while backgrounded, so the OS doesn't kill the process and the
  person has a way back into the app.
- Optionally keep the screen awake while a bake is actively running, so a
  timer left face-up on a counter stays visible without the phone locking.

## 6. Non-goals

- Multiple simultaneous bakes/timers — this is a single, one-bake-at-a-time
  tool.
- Any account system, cloud sync, or multi-device state.
- Recipes, oven temperature control, or anything beyond timing + the turn
  cue.
- Localizing the whole app to Polish (or any language) — the reference's
  Polish strings are specific UI copy (the ring's "SEKUND" caption and the
  info-line labels), not a signal to translate the whole product; keep
  English as the working language elsewhere unless told otherwise.

## 7. Open decisions for whoever builds this

Flagged throughout above, collected here:

1. Real preset duration list per oven type (§3.3) — literally `60/90/120`
   per the photo, or that plus a longer preheat option?
2. Does the "baked" half of the pizza always look fully baked, or should it
   still visually build up doneness over the course of a bake (§2.4)?
3. Where do the manual reset/play controls live, visually, given the
   reference shows none (§2.4)?
4. Sourcing the two photo assets described in §2.5 — required before the
   pizza clock can look like the reference at all.
