import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import type { ReactElement } from 'react';

/**
 * The handoff's line icons, drawn as Skia paths rather than pulled in as
 * an icon font: Skia is already a dependency for the pizza, and a path is the
 * only thing that keeps the 1.6-unit stroke identical at every size.
 *
 * Every path is authored in the same 24-unit box the handoff's SVGs use, so
 * they can be diffed against the prototype one glyph at a time. `timer` is
 * the one exception — added for the bottom nav bar in the warm restyle, not
 * from the handoff, styled to match the others by eye.
 */
export type IconName = 'play' | 'pause' | 'reset' | 'mic' | 'settings' | 'back' | 'timer';

type Glyph = { stroke?: readonly string[]; fill?: readonly string[]; circle?: { cx: number; cy: number; r: number } };

const GLYPHS: Record<IconName, Glyph> = {
  // Solid, like the prototype's transport: the play triangle reads as a
  // button, not an outline.
  play: { fill: ['M8.5 5.2 L18.8 12 L8.5 18.8 Z'] },
  pause: { fill: ['M9 5.4 h2.6 v13.2 h-2.6 z', 'M14.4 5.4 h2.6 v13.2 h-2.6 z'] },
  reset: { stroke: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'] },
  mic: {
    stroke: [
      'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z',
      'M19 10v2a7 7 0 0 1-14 0v-2',
      'M12 19v3',
    ],
  },
  settings: {
    stroke: [
      'M20 7h-9',
      'M14 17H5',
      'M17 14a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
      'M7 4a3 3 0 1 0 0 6 3 3 0 1 0 0-6',
    ],
  },
  back: { stroke: ['M15 18l-6-6 6-6'] },
  timer: {
    circle: { cx: 12, cy: 14, r: 8 },
    stroke: ['M10 2 L14 2', 'M12 14 L15 11'],
  },
};

export function Icon({
  name,
  size,
  color,
  strokeWidth = 1.6,
}: {
  name: IconName;
  size: number;
  color: string;
  strokeWidth?: number;
}): ReactElement {
  const glyph = GLYPHS[name];
  const scale = size / 24;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale }]}>
        {glyph.fill?.map((d) => (
          <Path key={d} path={d} color={color} style="fill" />
        ))}
        {glyph.stroke?.map((d) => (
          <Path
            key={d}
            path={d}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        ))}
        {glyph.circle ? (
          <Circle
            cx={glyph.circle.cx}
            cy={glyph.circle.cy}
            r={glyph.circle.r}
            color={color}
            style="stroke"
            strokeWidth={strokeWidth}
          />
        ) : null}
      </Group>
    </Canvas>
  );
}
