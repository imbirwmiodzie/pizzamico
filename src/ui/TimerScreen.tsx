import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
 * The single screen, restyled to match a reference photo the project owner
 * supplied: the "PIZZAORO" wordmark with a mic icon beside it, gradient
 * preset pills, the pizza clock face, a ring readout, a short "in the oven /
 * topping" line in Polish, and a dark two-icon bottom bar. Every domain read
 * below (bake state, voice, settings) is unchanged from the original build —
 * only how it's drawn moved.
 *
 * The photo has no visible reset/play controls — everything happens through
 * the mic there. This build keeps them, deliberately understated, as a slim
 * row above the bottom bar: voice is the primary path but not the only one.
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

  // The photo has no toggle for this, so it's just on for the length of a
  // bake — the one case a kitchen timer actually needs the screen awake.
  useEffect(() => {
    if (!bake.running) return undefined;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [bake.running]);

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
  // the illustration can never push the bottom bar off its own space.
  const [slot, setSlot] = useState({ width: 0, height: 0 });
  const onSlotLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setSlot((previous) => (previous.width === w && previous.height === h ? previous : { width: w, height: h }));
  };
  const illustrationSize = Math.max(0, Math.min(slot.width, slot.height, ILLUSTRATION_BOX));
  const ringSize = Math.min(width * 0.6, 248);

  const preheat = isPreheat(bake.presetSeconds);
  // Not shown on the ring itself — that's a fixed "SEKUND" label there, as in
  // the photo — but still spoken by the transcript line below the presets.
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
  const transcript = transcriptLine(voice, tone.micPrompt);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>PIZZAORO</Text>
        <Pressable
          onPress={voice.toggle}
          accessibilityRole="button"
          accessibilityState={{ selected: voice.listening }}
          accessibilityLabel={voice.listening ? 'Stop listening' : 'Listen for a command'}
          hitSlop={10}
          style={[styles.headerMic, voice.listening && styles.headerMicOn]}
        >
          <Icon name="mic" size={20} color={voice.listening ? Sunset.coral : Sunset.text} strokeWidth={1.7} />
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

        <CircularTimer progress={progress} size={ringSize} time={timeLabel(bake)} caption="Sekund" />

        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            W piecu od: <Text style={styles.infoValue}>{elapsedLabel(bake)}</Text>
          </Text>
          <Text style={styles.infoText}>
            Pizza: <Text style={styles.infoValue}>{toppingLabel(settings.toppingStyle)}</Text>
          </Text>
        </View>

        <Text style={styles.status}>{status}</Text>
        <Text style={styles.transcript} numberOfLines={1}>
          {voice.listening || transcript !== tone.micPrompt ? transcript : ' '}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={actions.reset}
          accessibilityRole="button"
          accessibilityLabel="Reset the timer"
          style={styles.controlButton}
        >
          <Icon name="reset" size={19} color={Sunset.text} />
        </Pressable>

        <Pressable
          onPress={actions.toggleRun}
          accessibilityRole="button"
          accessibilityLabel={bake.running ? 'Pause the bake' : 'Start the bake'}
          style={[styles.controlButton, styles.controlButtonPrimary]}
        >
          <Icon name={bake.running ? 'pause' : 'play'} size={19} color={Sunset.onPill} />
        </Pressable>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Space.s2 }]}>
        <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.bottomBarButton}>
          <Icon name="timer" size={22} color={Sunset.navyIcon} strokeWidth={1.8} />
        </View>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="tab"
          accessibilityLabel="Settings"
          style={styles.bottomBarButton}
        >
          <Icon name="settings" size={22} color={Sunset.navyIconMuted} />
        </Pressable>
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
  brand: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: Type.title,
    letterSpacing: 1,
    color: Sunset.text,
  },
  headerMic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMicOn: {
    backgroundColor: Sunset.chipOn,
  },
  presets: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: Space.s4,
    marginTop: Space.s1,
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
    // of overflowing into the controls and the bottom bar.
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
  status: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Sunset.textMuted,
  },
  transcript: {
    minHeight: 16,
    textAlign: 'center',
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Sunset.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s3,
    paddingVertical: Space.s2,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Sunset.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Sunset.hairline,
  },
  controlButtonPrimary: {
    backgroundColor: Sunset.redDeep,
    borderColor: Sunset.redDeep,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Space.s3,
    borderTopLeftRadius: Radius.lg + 16,
    borderTopRightRadius: Radius.lg + 16,
    backgroundColor: Sunset.navy,
  },
  bottomBarButton: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
