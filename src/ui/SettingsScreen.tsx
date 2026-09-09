import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppSettings, OvenPreset, ToppingStyle, VoiceTone } from '../domain/settings';
import { OVEN_PRESETS, presetLabel } from '../domain/settings';
import { Fonts, Radius, Space, Tokens, Type } from '../theme/tokens';
import { Icon } from './icons';
import { UpdateStatus } from './UpdateStatus';

/**
 * The three tweakables from the handoff — topping, tone, oven — and nothing
 * else. Each is a row of segments rather than a switch, because all three are
 * choices between named options, not on/off.
 */

const TOPPINGS: ReadonlyArray<[ToppingStyle, string]> = [
  ['pepperoni', 'Pepperoni'],
  ['margherita', 'Margherita'],
  ['veggie', 'Veggie'],
];

const TONES: ReadonlyArray<[VoiceTone, string]> = [
  ['casual', 'Casual'],
  ['formal', 'Formal'],
];

const OVENS: ReadonlyArray<[OvenPreset, string]> = [
  ['home', 'Home oven'],
  ['woodFired', 'Wood-fired'],
];

export function SettingsScreen({
  settings,
  onChange,
  onBack,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to the timer"
          style={styles.back}
          hitSlop={8}
        >
          <Icon name="back" size={22} color={Tokens.neutral800} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Space.s8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Field label="Topping" hint="What goes on the pie while it bakes.">
          <Segments
            options={TOPPINGS}
            value={settings.toppingStyle}
            onSelect={(toppingStyle) => onChange({ toppingStyle })}
          />
        </Field>

        <Field label="Voice tone" hint="How the app talks back. The Italian stays shouted either way.">
          <Segments
            options={TONES}
            value={settings.voiceTone}
            onSelect={(voiceTone) => onChange({ voiceTone })}
          />
        </Field>

        <Field
          label="Oven"
          hint={`Sets the three presets: ${OVEN_PRESETS[settings.ovenPreset]
            .map(presetLabel)
            .join(' · ')}.`}
        >
          <Segments
            options={OVENS}
            value={settings.ovenPreset}
            onSelect={(ovenPreset) => onChange({ ovenPreset })}
          />
        </Field>

        <UpdateStatus />
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      <Text style={styles.fieldHint}>{hint}</Text>
    </View>
  );
}

/** The same segmented control the timer's preset row uses, over named options. */
function Segments<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.segments}>
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Tokens.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s3,
    paddingHorizontal: Space.s4,
    paddingVertical: Space.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Tokens.divider,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: Type.title,
    color: Tokens.text,
  },
  body: {
    padding: Space.s4,
    gap: Space.s8,
  },
  field: {
    gap: Space.s2,
  },
  fieldLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.label,
    color: Tokens.neutral900,
    letterSpacing: 0.3,
  },
  fieldHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral500,
    lineHeight: 18,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: Tokens.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: Space.s2,
    alignItems: 'center',
    borderRadius: Radius.md,
  },
  segmentSelected: {
    backgroundColor: Tokens.accent100,
  },
  segmentLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.body,
    color: Tokens.neutral800,
  },
  segmentLabelSelected: {
    fontFamily: Fonts.bodySemiBold,
    color: Tokens.accent800,
  },
});
