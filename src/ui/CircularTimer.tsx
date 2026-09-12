import { Canvas, Circle, LinearGradient, Path, vec } from '@shopify/react-native-skia';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Sunset } from '../theme/tokens';

/**
 * The countdown as a ring rather than a bar — the disc's gradient and the
 * progress arc are the whole illustration, so the time itself carries the
 * "how far along" reading that the old linear bar used to.
 */

const TRACK_RATIO = 0.05;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A clockwise arc from 12 o'clock, `sweepDeg` degrees long. */
function arcPath(cx: number, cy: number, r: number, sweepDeg: number): string {
  const clamped = Math.min(359.9, Math.max(0.1, sweepDeg));
  const start = polarToCartesian(cx, cy, r, 0);
  const end = polarToCartesian(cx, cy, r, clamped);
  const largeArc = clamped > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function CircularTimer({
  progress,
  size,
  time,
  caption,
}: {
  /** 0 at the start of the bake, 1 at zero. */
  progress: number;
  size: number;
  time: string;
  caption: string;
}) {
  const centre = size / 2;
  const strokeWidth = size * TRACK_RATIO;
  const ringR = centre - strokeWidth;
  const discR = ringR - strokeWidth * 0.85;
  const swept = Math.min(1, Math.max(0, progress)) * 360;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={centre} cy={centre} r={discR}>
          <LinearGradient
            start={vec(centre - discR, centre - discR)}
            end={vec(centre + discR, centre + discR)}
            colors={[Sunset.coral, Sunset.redDeep]}
          />
        </Circle>
        <Circle
          cx={centre}
          cy={centre}
          r={ringR}
          style="stroke"
          strokeWidth={strokeWidth}
          color={Sunset.ringTrack}
        />
        {swept > 0.1 ? (
          <Path
            path={arcPath(centre, centre, ringR, swept)}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            color={Sunset.ringActive}
          />
        ) : null}
      </Canvas>
      <View style={styles.overlay} pointerEvents="none">
        <Text
          style={[styles.time, { fontSize: size * 0.185, lineHeight: size * 0.2 }]}
          accessibilityLabel={`${time} remaining`}
        >
          {time}
        </Text>
        <Text style={[styles.caption, { fontSize: size * 0.052 }]}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: Fonts.readout,
    color: Sunset.onDisc,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Sunset.onDiscMuted,
    marginTop: 4,
  },
});
