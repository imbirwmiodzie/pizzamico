import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isDone, isPaused, progressOf, timeLabel } from '../domain/bakeState';
import type { AppSettings } from '../domain/settings';
import { OVEN_PRESETS, isPreheat, presetLabel } from '../domain/settings';
import { ITALIAN_LINES, toneCopy } from '../domain/toneCopy';
import { transcriptLine } from '../domain/voiceStatus';
import { useBake } from '../state/useBake';
import { useVoice } from '../state/useVoice';
import { Fonts, Radius, Space, Sunset, Type, mixRgb } from '../theme/tokens';
import { CircularTimer } from './CircularTimer';
import { OvenIllustration } from './OvenIllustration';
import { ILLUSTRATION_BOX, PizzaIllustration } from './PizzaIllustration';
import { Icon } from './icons';

/**
 * The single screen. Layout follows the handoff top to bottom: header, the
 * presets, the pizza clock face, the ring readout, the microphone, the
 * transport bar, and the three things worth saying out loud.
 *
 * The ring readout, the gradient presets and the dark transport bar are a
 * later restyle onto a warmer palette (see `Sunset` in the theme tokens) —
 * everything else here, and every piece of domain state it reads, is
 * unchanged.
 */

/** The wake lock is scoped to this screen so nothing else can hold it open. */
const KEEP_AWAKE_TAG = 'pizza-timer-bake';
/** How long "Gira, gira! 🍕" stays up after a turn. */
const TOAST_MS = 2600;

export function TimerScreen({
  settings,
  onOpenSettings,
}: {
  settings: AppSettings;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { bake, actions } = useBake();
  const voice = useVoice(settings.voiceTone);

  const tone = toneCopy(settings.voiceTone);
  const done = isDone(bake);
  const paused = isPaused(bake);
  const progress = progressOf(bake);
  const presets = OVEN_PRESETS[settings.ovenPreset];

  const [keepAwake, setKeepAwake] = useState(true);
  useEffect(() => {
    if (!keepAwake || !bake.running) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [keepAwake, bake.running]);

  // The turn toast is driven by the same trigger the pizza's flip is, so it
  // shows up for a halfway cue and for a spoken "gira" alike.
  const [toast, setToast] = useState(false);
  const firstTrigger = useRef(bake.turnTrigger);
  useEffect(() => {
    if (bake.turnTrigger === firstTrigger.current) return undefined;
    setToast(true);
    const timer = setTimeout(() => setToast(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [bake.turnTrigger]);

  // Measured rather than guessed: the slot takes whatever height is left once
  // the readout, the presets and everything below them have had theirs, so
  // the illustration can never push the transport row off its own space.
  const [slot, setSlot] = useState({ width: 0, height: 0 });
  const onSlotLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSlot((previous) => (previous.width === w && previous.height === h ? previous : { width: w, height: h }));
  };
  const illustrationSize = Math.max(0, Math.min(slot.width, slot.height, ILLUSTRATION_BOX));
  const ringSize = Math.min(width * 0.56, 232);

  // Half an hour is the oven warming up, not a bake, and it says so.
  const preheat = isPreheat(bake.presetSeconds);
  const status = done
    ? preheat
      ? tone.preheated
      : tone.done
    : bake.running
      ? preheat
        ? tone.preheating
        : tone.baking
      : paused
        ? tone.paused
        : tone.ready;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>IL FORNO</Text>
          <Text style={styles.title}>Pizza Timer</Text>
        </View>
        <Pressable
          onPress={() => setKeepAwake((on) => !on)}
          accessibilityRole="switch"
          accessibilityState={{ checked: keepAwake }}
          accessibilityLabel="Keep the screen awake while baking"
          style={[styles.wakePill, keepAwake && styles.wakePillOn]}
          hitSlop={6}
        >
          <View style={[styles.wakeDot, keepAwake && styles.wakeDotOn]} />
          <Text style={[styles.wakeLabel, keepAwake && styles.wakeLabelOn]}>Stay awake</Text>
        </Pressable>
      </View>

      <View style={styles.presets}>
        {presets.map((seconds, index) => {
          const selected = seconds === bake.presetSeconds;
          const pillColor = mixRgb(Sunset.pillFrom, Sunset.pillTo, presets.length > 1 ? index / (presets.length - 1) : 0);
          return (
            <Pressable
              key={seconds}
              onPress={() => actions.selectPreset(seconds)}
              disabled={bake.running}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: bake.running }}
              style={[
                styles.preset,
                { backgroundColor: pillColor },
                !selected && styles.presetUnselected,
                bake.running && styles.presetDisabled,
              ]}
            >
              <Text style={styles.presetLabel}>{presetLabel(seconds)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.centre}>
        <View style={styles.illustrationSlot} onLayout={onSlotLayout}>
          {illustrationSize <= 0 ? null : preheat ? (
            <OvenIllustration
              progress={progress}
              running={bake.running}
              done={done}
              size={illustrationSize}
            />
          ) : (
            <PizzaIllustration
              progress={progress}
              running={bake.running}
              done={done}
              toppingStyle={settings.toppingStyle}
              turnTrigger={bake.turnTrigger}
              size={illustrationSize}
            />
          )}
          {toast ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.toast}>
              <Text style={styles.toastText}>{ITALIAN_LINES.turnToast}</Text>
            </Animated.View>
          ) : null}
        </View>

        <CircularTimer progress={progress} size={ringSize} time={timeLabel(bake)} caption={status} />

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            In the oven: <Text style={styles.infoValue}>{elapsedLabel(bake)}</Text>
          </Text>
          <Text style={styles.infoText}>
            Topping: <Text style={styles.infoValue}>{toppingLabel(settings.toppingStyle)}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.micZone}>
        <View style={styles.micWrap}>
          {voice.listening ? (
            <>
              <PulseRing delay={0} />
              <PulseRing delay={900} />
            </>
          ) : null}
          <Pressable
            onPress={voice.toggle}
            accessibilityRole="button"
            accessibilityState={{ selected: voice.listening }}
            accessibilityLabel={voice.listening ? 'Stop listening' : 'Listen for a command'}
            style={[styles.mic, voice.listening && styles.micOn]}
          >
            <Icon name="mic" size={30} color={Sunset.onDisc} strokeWidth={1.7} />
          </Pressable>
        </View>
        <Text style={styles.transcript} numberOfLines={2}>
          {transcriptLine(voice, tone.micPrompt)}
        </Text>
      </View>

      <View style={styles.transport}>
        <Pressable
          onPress={actions.reset}
          accessibilityRole="button"
          accessibilityLabel="Reset the timer"
          style={styles.secondary}
        >
          <Icon name="reset" size={22} color={Sunset.navyIcon} />
        </Pressable>

        <Pressable
          onPress={actions.toggleRun}
          accessibilityRole="button"
          accessibilityLabel={bake.running ? 'Pause the bake' : 'Start the bake'}
          style={styles.primary}
        >
          <Icon name={bake.running ? 'pause' : 'play'} size={28} color={Sunset.onDisc} />
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.secondary}
        >
          <Icon name="settings" size={22} color={Sunset.navyIcon} />
        </Pressable>
      </View>

      <View style={styles.hints}>
        <Text style={styles.hintsLabel}>Try saying</Text>
        <View style={styles.hintRow}>
          {tone.hints.map((hint) => (
            <View key={hint} style={styles.hint}>
              <Text style={styles.hintText}>“{hint}”</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** `m:ss` time spent in the oven so far — the mirror of `timeLabel`, which counts down. */
function elapsedLabel(bake: { presetSeconds: number; remaining: number }): string {
  const elapsed = Math.max(0, bake.presetSeconds - bake.remaining);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function toppingLabel(topping: AppSettings['toppingStyle']): string {
  switch (topping) {
    case 'pepperoni':
      return 'Pepperoni';
    case 'margherita':
      return 'Margherita';
    case 'veggie':
      return 'Veggie';
  }
}

/** One of the two rings that breathe out of the mic while it listens. */
function PulseRing({ delay }: { delay: number }) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = 0;
    const timer = setTimeout(() => {
      phase.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, phase]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(phase.value, [0, 1], [1, 1.6]) }],
    opacity: interpolate(phase.value, [0, 1], [0.35, 0]),
  }));

  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

const MIC = 72;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Sunset.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.s4,
    paddingTop: Space.s3,
    paddingBottom: Space.s2,
  },
  kicker: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.kicker,
    letterSpacing: 2.4,
    color: Sunset.kicker,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: Type.title,
    color: Sunset.text,
  },
  wakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s1,
    paddingHorizontal: Space.s2,
    paddingVertical: Space.s1 + 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Sunset.hairline,
    backgroundColor: Sunset.surface,
  },
  wakePillOn: {
    backgroundColor: Sunset.chipOn,
  },
  wakeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Sunset.textMuted,
  },
  wakeDotOn: {
    backgroundColor: Sunset.kicker,
  },
  wakeLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Sunset.textMuted,
  },
  wakeLabelOn: {
    color: Sunset.kicker,
  },
  presets: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: Space.s4,
    marginTop: Space.s2,
    gap: Space.s2,
  },
  preset: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: Space.s2 + 2,
    paddingHorizontal: Space.s2,
    borderRadius: Radius.lg + 12,
    borderWidth: 2,
    borderColor: Sunset.selectedRing,
  },
  presetUnselected: {
    opacity: 0.62,
    borderColor: 'transparent',
  },
  presetDisabled: {
    opacity: 0.4,
  },
  presetLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.body,
    color: Sunset.onPill,
  },
  centre: {
    flex: 1,
    // minHeight lets this shrink below its content on a short screen instead
    // of overflowing into the microphone and the transport row.
    minHeight: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s2,
  },
  illustrationSlot: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    paddingHorizontal: Space.s3,
    paddingVertical: Space.s1 + 2,
    borderRadius: Radius.lg,
    backgroundColor: Sunset.chipOn,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Sunset.hairline,
  },
  toastText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.body,
    color: Sunset.kicker,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.s4,
    marginTop: Space.s1,
  },
  infoText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.label,
    color: Sunset.textMuted,
  },
  infoValue: {
    fontFamily: Fonts.bodySemiBold,
    color: Sunset.text,
  },
  micZone: {
    alignItems: 'center',
    gap: Space.s2,
    paddingHorizontal: Space.s4,
  },
  micWrap: {
    width: MIC,
    height: MIC,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: Sunset.coral,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Sunset.redDeep,
  },
  micOn: {
    backgroundColor: Sunset.coral,
  },
  transcript: {
    minHeight: 38,
    textAlign: 'center',
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.label,
    lineHeight: 19,
    color: Sunset.textMuted,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
    marginHorizontal: Space.s4,
    marginVertical: Space.s3,
    paddingVertical: Space.s2,
    borderRadius: Radius.lg + 20,
    backgroundColor: Sunset.navy,
  },
  secondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Sunset.redDeep,
    // Pops just above the dark bar, like a floating action button.
    marginTop: -18,
    borderWidth: 4,
    borderColor: Sunset.bg,
  },
  hints: {
    alignItems: 'center',
    gap: Space.s2,
    paddingHorizontal: Space.s4,
    paddingBottom: Space.s4,
  },
  hintsLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Sunset.textMuted,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Space.s2,
  },
  hint: {
    paddingHorizontal: Space.s3,
    paddingVertical: Space.s1 + 2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Sunset.hairline,
    backgroundColor: Sunset.surface,
  },
  hintText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Sunset.text,
  },
});
