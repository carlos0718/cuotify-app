import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { ToastProvider, ErrorFallback } from '../components';
import { useAppBootstrap } from '../hooks';

export default function RootLayout() {
  const { isInitialized } = useAppBootstrap();

  if (!isInitialized) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(main)" />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ErrorFallback error={error} retry={retry} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
