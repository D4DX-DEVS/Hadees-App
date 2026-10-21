import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back';
import { ErrorBoundary } from '@/components/error-boundary';
import { HadithSheetProvider } from '@/components/hadith-sheet';
import { ShareCardProvider } from '@/components/share-card';
import { MenuButton, Sidebar, useIsWide } from '@/components/menu';
import { setupNotifications, syncDaily } from '@/lib/daily';
import { ensureFonts } from '@/lib/fonts';
import { uiFont } from '@/lib/theme';
import { LibraryProvider } from '@/state/library';
import { SettingsProvider, useSettings } from '@/state/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <LibraryProvider>
            <HadithSheetProvider>
              <ShareCardProvider>
                <Shell />
              </ShareCardProvider>
            </HadithSheetProvider>
          </LibraryProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { ready, colors, themeName, fonts } = useSettings();
  const [fontsReady, setFontsReady] = useState(false);
  const wide = useIsWide();

  // load UI font + the currently selected reading fonts (others load on demand)
  useEffect(() => {
    if (!ready) return;
    ensureFonts([uiFont.regular, uiFont.medium, uiFont.bold, fonts.ml, fonts.mlMedium, fonts.mlBold, fonts.ar, fonts.arBold])
      .catch(() => {})
      .finally(() => setFontsReady(true));
  }, [ready, fonts.ml, fonts.mlMedium, fonts.mlBold, fonts.ar, fonts.arBold]);

  // daily hadith: open the tapped hadith, and top up the schedule each time the app starts
  useEffect(() => {
    syncDaily().catch(() => {});
    return setupNotifications((id) => router.push({ pathname: '/hadith/[id]', params: { id: String(id) } }));
  }, []);

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  const base = themeName === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
  };

  return (
    <ErrorBoundary>
    <ThemeProvider value={navTheme}>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, flexDirection: 'row' }}>
      {wide ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: uiFont.bold, color: colors.text, fontSize: 16 },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" options={{ title: 'Hadees Vijnanakosham', headerLeft: () => <MenuButton /> }} />
        <Stack.Screen name="library" options={{ title: 'Library', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
        <Stack.Screen name="saved" options={{ title: 'Saved', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
        <Stack.Screen name="offline" options={{ title: 'Offline books', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
        <Stack.Screen name="feedback" options={{ title: 'Feedback', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
        <Stack.Screen name="search" options={{ title: 'Search', headerLeft: () => <BackButton /> }} />
        <Stack.Screen name="book/[id]" options={{ title: '', headerLeft: () => <BackButton /> }} />
        <Stack.Screen name="chapter/[id]" options={{ title: '', headerLeft: () => <BackButton /> }} />
        <Stack.Screen name="hadith/[id]" options={{ title: '', headerLeft: () => <BackButton /> }} />
        <Stack.Screen name="article/[id]" options={{ title: '', headerLeft: () => <BackButton />, headerRight: () => <MenuButton /> }} />
      </Stack>
      </View>
      </View>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
