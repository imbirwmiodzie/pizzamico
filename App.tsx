// Imported one weight per subpath, not from the package root: the root index
// requires every variant it ships, italics included, which is five megabytes
// of TTF in the APK for six faces we actually use.
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSettings } from './src/state/useSettings';
import { Tokens } from './src/theme/tokens';
import { SettingsScreen } from './src/ui/SettingsScreen';
import { TimerScreen } from './src/ui/TimerScreen';

/**
 * One screen and a settings sheet — not enough navigation to earn a router.
 *
 * Settings live here rather than in each screen because `useSettings` holds
 * its own state; two copies of the hook would be two copies of the truth.
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    Lora_400Regular,
    Lora_600SemiBold,
  });
  const { settings, loaded, update } = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  // Both the fonts and the stored settings decide what the first frame looks
  // like, so hold the paper-coloured background until they land.
  const ready = fontsLoaded && loaded;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {ready ? (
        showSettings ? (
          <SettingsScreen
            settings={settings}
            onChange={update}
            onBack={() => setShowSettings(false)}
          />
        ) : (
          <TimerScreen settings={settings} onOpenSettings={() => setShowSettings(true)} />
        )
      ) : (
        <View style={styles.blank} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
    backgroundColor: Tokens.bg,
  },
});
