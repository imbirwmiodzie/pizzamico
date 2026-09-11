import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ToppingStyle } from '../domain/settings';
import { Flame as FlameColors, Fonts, PizzaRamp, mixRgb } from '../theme/tokens';

/**
 * The pizza, the char, and the ring of fire.
 *
 * Everything here is drawn in the handoff's 200-unit viewbox and scaled once
 * at the end, so every coordinate below can be checked against the prototype
 * without arithmetic. The flames live in dp because the handoff sizes them
 * against the 196dp pie box, not against the viewbox.
 *
 * There is one frame clock. Fourteen flames, six toppings and three steam
 * wisps all read their phase off it and compute their own state
 * analytically — fourteen independent animations would be a lot of scheduler
 * churn for no visual difference. It only runs while something is actually
 * moving.
 *
 * The pie is also, literally, a clock face — a baked/raw-dough split on a
 * tilted line, twelve ticks, four numerals and two hands, from the timer
 * screen's warm restyle. The hands read `progress`, not wall-clock time: the
 * minute hand sweeps once across the whole bake and the hour hand creeps at
 * a twelfth of that, same ratio as a real clock. The face holds its own
 * orientation and never spins with a turn.
 */

/** The pie's own box, in dp, at the handoff's reference size. */
const PIE_BOX = 196;
/** The illustration's box. Bigger than the pie so the flames never clip. */
export const ILLUSTRATION_BOX = 322;

const CRUST_R = 96;
const CHEESE_R = 80;

const TOPPINGS = [
  [76, 78],
  [122, 72],
  [100, 108],
  [68, 122],
  [130, 126],
  [96, 148],
] as const;

const FLECKS = [
  [60, 60],
  [140, 65],
  [82, 168],
  [118, 172],
  [55, 100],
  [145, 105],
  [70, 40],
  [130, 42],
  [100, 172],
  [100, 45],
] as const;

/** x, y, r — revealed in this order as the bake darkens. */
const CHAR = [
  [40, 100, 4],
  [160, 95, 3.5],
  [100, 22, 4],
  [100, 178, 3.5],
  [62, 168, 3],
  [138, 32, 3.5],
  [34, 60, 3],
  [166, 140, 3.5],
] as const;

const FLAME_COUNT = 14;
/** The ring sits at 54% of the pizza box, measured from its centre. */
const FLAME_RING = 0.54;

/** Flicker keyframes: fraction of the loop → scaleX, scaleY, opacity. */
const FLICKER = [
  [0, 1, 1, 0.92],
  [0.3, 0.85, 1.3, 1],
  [0.6, 1.12, 0.82, 0.8],
  [1, 1, 1, 0.92],
] as const;

const TICK_OUTER = 92;
const TICK_INNER_MAJOR = 82;
const TICK_INNER_MINOR = 87;
const NUMERAL_R = 70;
const MINUTE_HAND_LEN = 62;
const HOUR_HAND_LEN = 42;
const HAND_PIVOT_R = 3.4;

const CLOCK_NUMERALS = [
  { label: '12', angle: 0 },
  { label: '3', angle: 90 },
  { label: '6', angle: 180 },
  { label: '9', angle: 270 },
] as const;

function polarPoint(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) };
}

function tickPath(index: number): string {
  const angle = index * 30;
  const major = index % 3 === 0;
  const outer = polarPoint(angle, TICK_OUTER);
  const inner = polarPoint(angle, major ? TICK_INNER_MAJOR : TICK_INNER_MINOR);
  return `M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`;
}

function handPath(angleDeg: number, length: number): string {
  const tip = polarPoint(angleDeg, length);
  return `M 100 100 L ${tip.x} ${tip.y}`;
}

/**
 * The baked/dough boundary, tilted rather than a plain diameter, to match
 * the reference photo: pizza fills the lower-left, dough the upper-right,
 * along a line from roughly 11 o'clock to 5 o'clock.
 */
const SPLIT_ANGLE_DEG = -35;
const BAKED_HALF_CLIP = (() => {
  const rad = (SPLIT_ANGLE_DEG * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  // A square covering the local x <= 0 half-plane, rotated around (100, 100)
  // and sized well past the crust radius so the rotation never leaves a gap.
  const FAR = 400;
  const rotate = (x: number, y: number) => ({ x: 100 + x * c - y * s, y: 100 + x * s + y * c });
  const corners = [rotate(-FAR, -FAR), rotate(0, -FAR), rotate(0, FAR), rotate(-FAR, FAR)];
  return `M ${corners[0]!.x} ${corners[0]!.y} L ${corners[1]!.x} ${corners[1]!.y} L ${corners[2]!.x} ${corners[2]!.y} L ${corners[3]!.x} ${corners[3]!.y} Z`;
})();

const TURN_MS = 850;
/** Toppings bob on this loop, staggered by index. */
const BOB_SECONDS = 2.4;
const BOB_STAGGER = 0.15;
/** The done pulse, and the steam above it. */
const PULSE_SECONDS = 1.6;
const STEAM_SECONDS = 1.8;

type Props = {
  /** 0 at the top of the bake, 1 at zero. */
  progress: number;
  running: boolean;
  done: boolean;
  toppingStyle: ToppingStyle;
  /** Increments every time the pie should flip, wherever the turn came from. */
  turnTrigger: number;
  /** The illustration's edge length in dp. */
  size: number;
};

/** Where in a `period`-second loop we are, given a delay. Range [0, 1). */
function phaseOf(millis: number, period: number, delay: number): number {
  'worklet';
  const seconds = millis / 1000 - delay;
  const wrapped = seconds % period;
  return (wrapped < 0 ? wrapped + period : wrapped) / period;
}

export function PizzaIllustration({
  progress,
  running,
  done,
  toppingStyle,
  turnTrigger,
  size,
}: Props) {
  // One clock for the whole illustration, stopped whenever nothing moves.
  const clock = useSharedValue(0);
  const frame = useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
  }, false);

  const animating = running || done;
  useEffect(() => {
    frame.setActive(animating);
  }, [animating, frame]);

  // The flip. Driven by the trigger rather than by any one caller, so a turn
  // fired by the halfway cue, by "gira", or by the native service all land here.
  const spin = useSharedValue(0);
  useEffect(() => {
    if (turnTrigger === 0) return;
    spin.value = 0;
    spin.value = withTiming(
      Math.PI,
      { duration: TURN_MS, easing: Easing.inOut(Easing.ease) },
      (finished) => {
        // Snap back rather than unwinding: the pie is symmetric, so 180° and
        // 0° look identical and the next turn starts from a known angle.
        if (finished) spin.value = 0;
      },
    );
  }, [turnTrigger, spin]);

  const pieBox = (size * PIE_BOX) / ILLUSTRATION_BOX;
  /** dp per handoff dp — the flames' sizes are authored against a 196dp pie. */
  const k = pieBox / PIE_BOX;
  /** dp per viewbox unit. */
  const unit = pieBox / 200;
  const centre = size / 2;

  const crust = mixRgb(PizzaRamp.rawCrust, PizzaRamp.bakedCrust, progress);
  // Cheese browns more slowly than the crust — until the bake ends, when it
  // goes the whole way (handoff).
  const cheese = mixRgb(PizzaRamp.rawCheese, PizzaRamp.bakedCheese, done ? 1 : progress * 0.85);
  const pepperoni = mixRgb(PizzaRamp.rawPepperoni, PizzaRamp.bakedPepperoni, progress);
  const veggie = mixRgb(PizzaRamp.rawVeggie, PizzaRamp.bakedVeggie, progress);

  const charCount = Math.round((Math.max(0, progress - 0.45) / 0.55) * CHAR.length);
  const charOpacity = 0.25 + progress * 0.35;

  const toppingRadius = toppingStyle === 'pepperoni' ? 8.5 : 6;
  const toppingColor = toppingStyle === 'pepperoni' ? pepperoni : veggie;

  // Fixed orientation, unlike the pie: the clock face never spins with a turn.
  const faceTransform = [
    { translateX: centre },
    { translateY: centre },
    { scale: unit },
    { translateX: -100 },
    { translateY: -100 },
  ];
  const clamped = Math.min(1, Math.max(0, progress));
  const minuteAngle = clamped * 360;
  const hourAngle = minuteAngle / 12;

  const pieTransform = useDerivedValue(() => {
    const pulse = done ? 1 + 0.02 * (1 - Math.cos(2 * Math.PI * phaseOf(clock.value, PULSE_SECONDS, 0))) : 1;
    return [
      { translateX: centre },
      { translateY: centre },
      { rotate: spin.value },
      { scale: unit * pulse },
      { translateX: -100 },
      { translateY: -100 },
    ];
  }, [centre, unit, done]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {running ? <FireRing clock={clock} centre={centre} pieBox={pieBox} k={k} /> : null}
  
        <Group transform={pieTransform}>
          {/* The right half stays plain, unrisen dough; the left half, clipped
              below, is the usual baked pizza. */}
          <Circle cx={100} cy={100} r={CRUST_R} color={`rgb(${PizzaRamp.rawCrust.join(', ')})`} />
  
          <Group clip={BAKED_HALF_CLIP}>
            <Circle cx={100} cy={100} r={CRUST_R} color={crust} />
            <Circle cx={100} cy={100} r={CHEESE_R} color={cheese} />
  
            {FLECKS.map(([x, y]) => (
              <Circle key={`fleck-${x}-${y}`} cx={x} cy={y} r={1.5} color={PizzaRamp.fleck} />
            ))}
  
            {toppingStyle === 'margherita'
              ? null
              : TOPPINGS.map(([x, y], i) => (
                  <Topping
                    key={`topping-${x}-${y}`}
                    clock={clock}
                    index={i}
                    x={x}
                    y={y}
                    r={toppingRadius}
                    color={toppingColor}
                    running={running}
                  />
                ))}
  
            {CHAR.slice(0, charCount).map(([x, y, r]) => (
              <Circle key={`char-${x}-${y}`} cx={x} cy={y} r={r} color={PizzaRamp.char} opacity={charOpacity} />
            ))}
          </Group>
        </Group>
  
        {/* Ticks and hands read like a clock face, so they hold their own
            orientation rather than spinning with a turn. */}
        <Group transform={faceTransform}>
          {Array.from({ length: 12 }, (_, i) => (
            <Path
              key={`tick-${i}`}
              path={tickPath(i)}
              style="stroke"
              strokeWidth={i % 3 === 0 ? 1.8 : 1}
              strokeCap="round"
              color={PizzaRamp.char}
              opacity={0.75}
            />
          ))}
          <Path
            path={handPath(hourAngle, HOUR_HAND_LEN)}
            style="stroke"
            strokeWidth={3.2}
            strokeCap="round"
            color={PizzaRamp.char}
          />
          <Path
            path={handPath(minuteAngle, MINUTE_HAND_LEN)}
            style="stroke"
            strokeWidth={2.2}
            strokeCap="round"
            color={PizzaRamp.char}
          />
          <Circle cx={100} cy={100} r={HAND_PIVOT_R} color={PizzaRamp.char} />
        </Group>
  
        {done ? <Steam clock={clock} centre={centre} pieBox={pieBox} k={k} /> : null}
      </Canvas>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {CLOCK_NUMERALS.map(({ label, angle }) => {
          const p = polarPoint(angle, NUMERAL_R);
          const x = centre + (p.x - 100) * unit;
          const y = centre + (p.y - 100) * unit;
          return (
            <View
              key={label}
              style={[styles.numeralBox, { left: x - NUMERAL_BOX / 2, top: y - NUMERAL_BOX / 2 }]}
            >
              <Text style={[styles.numeral, { fontSize: 13 * unit }]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const NUMERAL_BOX = 22;

const styles = StyleSheet.create({
  numeralBox: {
    position: 'absolute',
    width: NUMERAL_BOX,
    height: NUMERAL_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeral: {
    fontFamily: Fonts.bodySemiBold,
    color: PizzaRamp.char,
  },
});

/* ── toppings ────────────────────────────────────────────────────────────── */

function Topping({
  clock,
  index,
  x,
  y,
  r,
  color,
  running,
}: {
  clock: SharedValue<number>;
  index: number;
  x: number;
  y: number;
  r: number;
  color: string;
  running: boolean;
}) {
  // A bob, not a bounce: the eased cosine spends most of its time near the
  // ends, which is what the prototype's keyframes do.
  const transform = useDerivedValue(() => {
    if (!running) return [{ translateY: 0 }, { scale: 1 }];
    const phase = phaseOf(clock.value, BOB_SECONDS, index * BOB_STAGGER);
    const eased = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    return [{ translateY: -1.4 * eased }, { scale: 1 + 0.05 * eased }];
  }, [running, index]);

  return (
    <Group transform={transform} origin={vec(x, y)}>
      <Circle cx={x} cy={y} r={r} color={color} />
    </Group>
  );
}

/* ── the fire ring ───────────────────────────────────────────────────────── */

/** An upright teardrop: a point at the top, a round base. */
function teardrop(w: number, h: number): string {
  const half = w / 2;
  const baseY = h / 2 - half;
  return [
    `M 0 ${-h / 2}`,
    `C ${half * 0.85} ${-h * 0.1} ${half} ${baseY - half * 0.55} ${half} ${baseY}`,
    `A ${half} ${half} 0 0 1 ${-half} ${baseY}`,
    `C ${-half} ${baseY - half * 0.55} ${-half * 0.85} ${-h * 0.1} 0 ${-h / 2}`,
    'Z',
  ].join(' ');
}

function FireRing({
  clock,
  centre,
  pieBox,
  k,
}: {
  clock: SharedValue<number>;
  centre: number;
  pieBox: number;
  k: number;
}) {
  const ring = pieBox * FLAME_RING;

  return (
    <Group>
      <Circle cx={centre} cy={centre} r={ring * 1.3}>
        <RadialGradient
          c={vec(centre, centre)}
          r={ring * 1.3}
          colors={[
            'rgba(255, 106, 26, 0)',
            'rgba(255, 106, 26, 0.18)',
            'rgba(255, 106, 26, 0.26)',
            'rgba(255, 106, 26, 0)',
          ]}
          positions={[0, 0.55, 0.78, 1]}
        />
      </Circle>

      {Array.from({ length: FLAME_COUNT }, (_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / FLAME_COUNT;
        const w = (24 + (i % 3) * 8) * k;
        const h = (46 + (i % 4) * 14) * k;
        return (
          <FlameShape
            key={`flame-${i}`}
            clock={clock}
            index={i}
            // The handoff anchors each flame at (-50%, -38%) of its own box,
            // which puts the box's centre 12% of its height below the point
            // on the ring.
            x={centre + ring * Math.cos(angle)}
            y={centre + ring * Math.sin(angle) + h * 0.12}
            w={w}
            h={h}
          />
        );
      })}
    </Group>
  );
}

function FlameShape({
  clock,
  index,
  x,
  y,
  w,
  h,
}: {
  clock: SharedValue<number>;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const period = 0.6 + (index % 3) * 0.18;
  const delay = (index * 0.11) % 1.2;

  const transform = useDerivedValue(() => {
    const phase = phaseOf(clock.value, period, delay);
    let i = 0;
    while (i < FLICKER.length - 2 && phase >= (FLICKER[i + 1]?.[0] ?? 1)) i += 1;
    const from = FLICKER[i] ?? FLICKER[0];
    const to = FLICKER[i + 1] ?? FLICKER[FLICKER.length - 1];
    const span = (to?.[0] ?? 1) - (from?.[0] ?? 0) || 1;
    const t = ((phase - (from?.[0] ?? 0)) / span);
    return [
      { translateX: x },
      { translateY: y },
      { scaleX: (from?.[1] ?? 1) + ((to?.[1] ?? 1) - (from?.[1] ?? 1)) * t },
      { scaleY: (from?.[2] ?? 1) + ((to?.[2] ?? 1) - (from?.[2] ?? 1)) * t },
    ];
  }, [x, y, period, delay]);

  const opacity = useDerivedValue(() => {
    const phase = phaseOf(clock.value, period, delay);
    let i = 0;
    while (i < FLICKER.length - 2 && phase >= (FLICKER[i + 1]?.[0] ?? 1)) i += 1;
    const from = FLICKER[i] ?? FLICKER[0];
    const to = FLICKER[i + 1] ?? FLICKER[FLICKER.length - 1];
    const span = (to?.[0] ?? 1) - (from?.[0] ?? 0) || 1;
    const t = (phase - (from?.[0] ?? 0)) / span;
    return (from?.[3] ?? 1) + ((to?.[3] ?? 1) - (from?.[3] ?? 1)) * t;
  }, [period, delay]);

  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={teardrop(w, h)}>
        <LinearGradient
          start={vec(0, h / 2)}
          end={vec(0, -h / 2)}
          colors={[FlameColors.deep, FlameColors.orange, FlameColors.amber, FlameColors.pale, 'rgba(255, 215, 95, 0)']}
          positions={[0, 0.35, 0.65, 0.88, 1]}
        />
      </Path>
    </Group>
  );
}

/* ── steam, once it's out of the oven ────────────────────────────────────── */

function Steam({
  clock,
  centre,
  pieBox,
  k,
}: {
  clock: SharedValue<number>;
  centre: number;
  pieBox: number;
  k: number;
}) {
  const top = centre - (pieBox / 200) * CRUST_R - 8 * k;
  return (
    <Group>
      {[-1, 0, 1].map((offset, i) => (
        <Wisp key={`wisp-${offset}`} clock={clock} index={i} x={centre + offset * 20 * k} y={top} k={k} />
      ))}
    </Group>
  );
}

function Wisp({
  clock,
  index,
  x,
  y,
  k,
}: {
  clock: SharedValue<number>;
  index: number;
  x: number;
  y: number;
  k: number;
}) {
  const transform = useDerivedValue(() => {
    const phase = phaseOf(clock.value, STEAM_SECONDS, index * 0.6);
    return [{ translateX: x }, { translateY: y - 34 * k * phase }];
  }, [x, y, k, index]);

  const opacity = useDerivedValue(() => {
    const phase = phaseOf(clock.value, STEAM_SECONDS, index * 0.6);
    return Math.sin(Math.PI * phase) * 0.45;
  }, [index]);

  const wisp = `M 0 0 C ${5 * k} ${-7 * k} ${-5 * k} ${-13 * k} 0 ${-20 * k}`;

  return (
    <Group transform={transform} opacity={opacity}>
      <Path
        path={wisp}
        style="stroke"
        strokeWidth={2.2 * k}
        strokeCap="round"
        color={PizzaRamp.fleck}
      />
    </Group>
  );
}
