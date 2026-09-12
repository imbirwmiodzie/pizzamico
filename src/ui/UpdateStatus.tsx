import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeBundle } from '../domain/updateInfo';
import { Fonts, Radius, Space, Tokens, Type } from '../theme/tokens';

/**
 * Which JavaScript is running, and a button to go and get a newer one.
 *
 * The button exists because the default update behaviour is easy to mistake
 * for a broken one: expo-updates launches from the cached bundle and fetches
 * the new one in the background, so a freshly published change only appears
 * on the *next* launch. Checking here downloads and restarts on the spot,
 * which turns "did it update?" into something you can answer in one tap.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'downloading' }
  | { kind: 'current' }
  | { kind: 'failed'; message: string };

export function UpdateStatus() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const bundle = describeBundle({
    enabled: Updates.isEnabled,
    embedded: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
  });

  const busy = state.kind === 'checking' || state.kind === 'downloading';

  async function check() {
    setState({ kind: 'checking' });
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState({ kind: 'current' });
        return;
      }
      setState({ kind: 'downloading' });
      await Updates.fetchUpdateAsync();
      // Restarts into the bundle just downloaded, rather than waiting for the
      // next cold start to pick it up.
      await Updates.reloadAsync();
    } catch (error) {
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : 'Could not reach the update server.',
      });
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Version</Text>

      <View style={styles.rows}>
        <Row name="Running" value={bundle} />
        <Row name="Channel" value={Updates.channel ?? '—'} />
        <Row name="Runtime" value={Updates.runtimeVersion ?? '—'} />
      </View>

      <Pressable
        onPress={check}
        disabled={busy || !Updates.isEnabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || !Updates.isEnabled }}
        style={[styles.button, (busy || !Updates.isEnabled) && styles.buttonDisabled]}
      >
        {busy ? <ActivityIndicator size="small" color={Tokens.accent800} /> : null}
        <Text style={styles.buttonLabel}>{buttonLabel(state)}</Text>
      </Pressable>

      <Text style={styles.hint}>{hint(state)}</Text>
    </View>
  );
}

function buttonLabel(state: State): string {
  switch (state.kind) {
    case 'checking':
      return 'Checking…';
    case 'downloading':
      return 'Downloading…';
    default:
      return 'Check for updates';
  }
}

function hint(state: State): string {
  switch (state.kind) {
    case 'current':
      return 'This is the newest version.';
    case 'downloading':
      return 'The app will restart when it finishes.';
    case 'failed':
      return state.message;
    default:
      return 'Compare the update id above with the one on expo.dev.';
  }
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{name}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Space.s2,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.label,
    color: Tokens.neutral900,
    letterSpacing: 0.3,
  },
  rows: {
    gap: Space.s1,
    padding: Space.s3,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
    backgroundColor: Tokens.surface,
  },
  row: {
    flexDirection: 'row',
    gap: Space.s2,
  },
  rowName: {
    width: 68,
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral500,
  },
  rowValue: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral900,
    // The ids only tell two builds apart if the digits line up.
    fontVariant: ['tabular-nums'],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s2,
    paddingVertical: Space.s2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Tokens.divider,
    backgroundColor: Tokens.accent100,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Type.body,
    color: Tokens.accent800,
  },
  hint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: Type.chip,
    color: Tokens.neutral500,
    lineHeight: 18,
  },
});
