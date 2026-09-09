import {
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import { useEffect } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { OvenRamp, mixRgb } from '../theme/tokens';

/**
 * The oven, for the long preset — half an hour is the oven coming up to
 * temperature, not a bake, and a pizza slowly turning black would be the
 * wrong thing to watch for thirty minutes.
 *
 * Follows the pizza's two rules: everything is drawn in one fixed unit space
 * and scaled once at the end, and every moving part reads its phase off a
 * single frame callback that stops whenever nothing is moving.
 *
 * Unlike the pizza, the unit space here *is* the 322-unit box rather than the
 * handoff's 200-unit viewbox, because there is no prototype to diff against —
 * so the numbers below are the box, centred on (161, 161).
 */

/** Matches the pizza's box, so swapping the two never moves the layout. */
export const ILLUSTRATION_BOX = 322;
const CENTRE = ILLUSTRATION_BOX / 2;

const BODY = { x: 61, y: 51, w: 200, h: 220, r: 14 };
const CAVITY = { x: 79, y: 143, w: 164, h: 112, r: 8 };
const HANDLE = { x: 79, y: 119, w: 164, h: 12, r: 6 };
const DISPLAY = { x: 131, y: 71, w: 60, h: 20, r: 5 };
const KNOBS = [96, 226];
const KNOB_Y = 81;
const KNOB_R = 9;

/** The two elements inside the cavity, and how far the zigzag swings. */
const COIL_Y = [175, 225];
const COIL_FROM = 99;
const COIL_TO = 223;
const COIL_SWING = 5;

const PULSE_SECONDS = 1.6;
/** Each coil breathes on its own period so the glow never looks mechanical. */
const FLICKER = [0.9, 1.15];

type Props = {
  /** 0 cold, 1 up to temperature. */
  progress: number;
  running: boolean;
  done: boolean;
  size: number;
};

function phaseOf(millis: number, period: number, delay: number): number {
  'worklet';
  const seconds = millis / 1000 - delay;
  const wrapped = seconds % period;
  return (wrapped < 0 ? wrapped + period : wrapped) / period;
}

/** A flat zigzag element, drawn left to right at a given height. */
export function coilPath(y: number): string {
  const steps = 8;
  const step = (COIL_TO - COIL_FROM) / steps;
  let d = `M ${COIL_FROM} ${y}`;
  for (let i = 0; i < steps; i++) {
    d += ` L ${COIL_FROM + step * (i + 0.5)} ${y + (i % 2 === 0 ? -COIL_SWING : COIL_SWING)}`;
  }
  return `${d} L ${COIL_TO} ${y}`;
}

export function OvenIllustration({ progress, running, done, size }: Props) {
  const clock = useSharedValue(0);
  const frame = useFrameCallback((info) => {
    clock.value = info.timeSinceFirstFrame;
  }, false);

  const animating = running || done;
  useEffect(() => {
    frame.setActive(animating);
  }, [animating, frame]);

  const unit = size / ILLUSTRATION_BOX;

  const cavity = mixRgb(OvenRamp.coldCavity, OvenRamp.hotCavity, progress);
  const coil = mixRgb(OvenRamp.coldCoil, OvenRamp.hotCoil, done ? 1 : progress);
  // The cavity's own light, which only really shows once there is some heat.
  const glow = `rgba(255, 106, 26, ${(done ? 0.55 : progress * 0.5).toFixed(3)})`;

  const transform = useDerivedValue(() => {
    const pulse = done
      ? 1 + 0.015 * (1 - Math.cos(2 * Math.PI * phaseOf(clock.value, PULSE_SECONDS, 0)))
      : 1;
    return [
      { translateX: size / 2 },
      { translateY: size / 2 },
      { scale: unit * pulse },
      { translateX: -CENTRE },
      { translateY: -CENTRE },
    ];
  }, [size, unit, done]);

  const glowCentre = vec(CAVITY.x + CAVITY.w / 2, CAVITY.y + CAVITY.h / 2);

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={transform}>
        <RoundedRect {...rect(BODY)} color={OvenRamp.body} />
        <RoundedRect {...rect(BODY)} color={OvenRamp.trim} style="stroke" strokeWidth={2.5} />

        {KNOBS.map((x) => (
          <Circle key={x} cx={x} cy={KNOB_Y} r={KNOB_R} color={OvenRamp.trim} />
        ))}
        {/* The panel display warms up with the cavity. */}
        <RoundedRect {...rect(DISPLAY)} color={cavity} />
        <RoundedRect {...rect(HANDLE)} color={OvenRamp.trim} />

        <RoundedRect {...rect(CAVITY)} color={cavity} />
        <Circle cx={glowCentre.x} cy={glowCentre.y} r={CAVITY.w / 2}>
          <RadialGradient
            c={glowCentre}
            r={CAVITY.w / 2}
            colors={[glow, 'rgba(255, 106, 26, 0)']}
            positions={[0, 1]}
          />
        </Circle>

        {COIL_Y.map((y, i) => (
          <Coil key={y} clock={clock} index={i} y={y} colour={coil} running={running} />
        ))}

        {/* Drawn last so the door frame sits over the glow and the coils. */}
        <RoundedRect
          {...rect(CAVITY)}
          color={OvenRamp.outline}
          style="stroke"
          strokeWidth={3}
        />
      </Group>
    </Canvas>
  );
}

function rect(r: { x: number; y: number; w: number; h: number; r: number }) {
  return { x: r.x, y: r.y, width: r.w, height: r.h, r: r.r };
}

function Coil({
  clock,
  index,
  y,
  colour,
  running,
}: {
  clock: SharedValue<number>;
  index: number;
  y: number;
  colour: string;
  running: boolean;
}) {
  const opacity = useDerivedValue(() => {
    if (!running) return 1;
    const period = FLICKER[index % FLICKER.length] ?? 1;
    const phase = phaseOf(clock.value, period, index * 0.2);
    return 0.78 + 0.22 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
  }, [running, index]);

  return (
    <Group opacity={opacity}>
      <Path
        path={coilPath(y)}
        color={colour}
        style="stroke"
        strokeWidth={4}
        strokeCap="round"
        strokeJoin="round"
      />
    </Group>
  );
}
