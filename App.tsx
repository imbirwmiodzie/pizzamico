/**
 * Placeholder root. It exists so the first APK can be built and the native
 * module proven on a device before any UI is written (HANDOFF.md, "Not built
 * yet"). Replace it with the real screen switch: TimerScreen / SettingsScreen.
 */
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Space, Tokens } from './src/theme/tokens';

export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Pizza Timer</Text>
      <Text style={styles.body}>The UI is not built yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Tokens.bg,
    padding: Space.s6,
  },
  title: {
    fontSize: 32,
    color: Tokens.accent700,
    marginBottom: Space.s3,
  },
  body: {
    fontSize: 16,
    color: Tokens.neutral800,
  },
});
