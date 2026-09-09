import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { Fonts, Radius, Space, Tokens, Type } from '../theme/tokens';
import { OvenIllustration } from './OvenIllustration';
import { ILLUSTRATION_BOX, PizzaIllustration } from './PizzaIllustration';
import { Icon } from './icons';

/**
 * The single screen. Layout follows the handoff top to bottom: header, the
 * pizza with its readout and presets, the microphone, the transport, and the
 * three things worth saying out loud.
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
    const { width, height } = event.nativeEvent.layout;
    setSlot((previous) =>
      previous.width === width && previous.height === height ? previous : { width, height },
    );
  };
  const illustrationSize = Math.max(
    0,
    Math.min(slot.width, slot.height, ILLUSTRATION_BOX),
  );

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

        <Text style={styles.readout} accessibilityLabel={`${timeLabel(bake)} remaining`}>
          {timeLabel(bake)}
        </Text>
        <Text style={[styles.status, done && styles.statusDone]}>{status}</Text>

        <ProgressBar progress={progress} />

        <View style={styles.presets}>
          {presets.map((seconds) => {
            const selected = seconds === bake.presetSeconds;
            return (
              <Pressable
                key={seconds}
                onPress={() => actions.selectPreset(seconds)}
                disabled={bake.running}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: bake.running }}
                style={[
                  styles.preset,
                  selected && styles.presetSelected,
                  bake.running && styles.presetDisabled,
                ]}
              >
                <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>
                  {presetLabel(seconds)}
                </Text>
              </Pressable>
            );
          })}
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
            <Icon
              name="mic"
              size={30}
              color={voice.listening ? Tokens.neutral100 : Tokens.accent700}
              strokeWidth={1.7}
            />
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
          <Icon name="reset" size={22} color={Tokens.neutral800} />
        </Pressable>

        <Pressable
          onPress={actions.toggleRun}
          accessibilityRole="button"
          accessibilityLabel={bake.running ? 'Pause the bake' : 'Start the bake'}
          style={styles.primary}
        >
          <Icon
            name={bake.running ? 'pause' : 'play'}
            size={28}
            color={Tokens.neutral100}
          />
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.secondary}
        >
          <Icon name="settings" size={22} color={Tokens.neutral800} />
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

/**
 * How far through the bake we are, as a bar rather than as char marks on the
 * pizza. The illustration shows the mood; this shows the number.
 */
function ProgressBar({ progress }: { progress: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
    >
      <View style={[styles.fill, { width: `${percent}%` }]} />
    </View>
  );
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
    backgroundColor: Tokens.bg,
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
    color: Tokens.accent700,
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: Type.title,
    color: Tokens.text,
  },
  wakePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s1,
    paddingHorizontal: Space.s2,
    paddingVertical: Space.s1 + 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
    backgroundColor: Tokens.surface,
  },
  wakePillOn: {
    backgroundColor: Tokens.accent100,
  },
  wakeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Tokens.neutral500,
  },
  wakeDotOn: {
    backgroundColor: Tokens.accent,
  },
  wakeLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral500,
  },
  wakeLabelOn: {
    color: Tokens.accent800,
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
    backgroundColor: Tokens.accent100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
  },
  toastText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.body,
    color: Tokens.accent800,
  },
  readout: {
    fontFamily: Fonts.readout,
    fontSize: Type.readout,
    // Lora carries taller ascenders than the display serif did, so the line
    // box has to grow with it or the digits clip.
    lineHeight: Type.readout * 1.14,
    color: Tokens.accent700,
    // The seconds must not shuffle the minutes sideways once a second.
    fontVariant: ['tabular-nums'],
  },
  status: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.body,
    color: Tokens.neutral500,
  },
  statusDone: {
    fontFamily: Fonts.bodySemiBold,
    color: Tokens.accent800,
  },
  track: {
    alignSelf: 'stretch',
    marginHorizontal: Space.s4,
    marginTop: Space.s1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Tokens.neutral200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Tokens.accent,
  },
  presets: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: Space.s4,
    marginTop: Space.s2,
    backgroundColor: Tokens.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
    padding: 3,
    gap: 3,
  },
  preset: {
    // Share the row evenly, so three chips and four both look deliberate.
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: Space.s2,
    paddingHorizontal: Space.s2,
    borderRadius: Radius.md,
  },
  presetSelected: {
    backgroundColor: Tokens.accent100,
  },
  presetDisabled: {
    opacity: 0.55,
  },
  presetLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.body,
    color: Tokens.neutral800,
  },
  presetLabelSelected: {
    fontFamily: Fonts.bodySemiBold,
    color: Tokens.accent800,
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
    backgroundColor: Tokens.accent,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.accent100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
  },
  micOn: {
    backgroundColor: Tokens.accent,
    borderColor: Tokens.accent2,
  },
  transcript: {
    minHeight: 38,
    textAlign: 'center',
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.label,
    lineHeight: 19,
    color: Tokens.neutral500,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s8,
    paddingVertical: Space.s3,
  },
  secondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
  },
  primary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.accent,
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
    color: Tokens.neutral500,
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
    borderColor: Tokens.divider,
    backgroundColor: Tokens.neutral100,
  },
  hintText: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral800,
  },
});
