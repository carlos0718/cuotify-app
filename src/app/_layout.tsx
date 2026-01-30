import { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '../store';
import { ToastProvider } from '../components';
import {
  registerForPushNotifications,
  savePushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../services/notifications';

// Tipo para la suscripción
type NotificationSubscription = { remove: () => void };

export default function RootLayout() {
  const { initialize, isInitialized, user } = useAuthStore();
  const notificationListener = useRef<NotificationSubscription | null>(null);
  const responseListener = useRef<NotificationSubscription | null>(null);

  // Inicializar auth
  useEffect(() => {
    initialize();
  }, []);

  // Configurar notificaciones cuando el usuario está autenticado
  useEffect(() => {
    if (!user) return;

    // Registrar para push notifications
    registerForPushNotifications().then((token) => {
      if (token) {
        savePushToken(user.id, token);
      }
    });

    // Listener cuando llega una notificación (app en primer plano)
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notificación recibida:', notification);
    });

    // Listener cuando el usuario toca una notificación
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Usuario tocó notificación:', data);

      // Navegar según el tipo de notificación
      if (data?.type === 'payment_reminder' || data?.type === 'payment_overdue') {
        if (data?.loanId) {
          router.push(`/(main)/loans/${data.loanId}`);
        }
      } else if (data?.type === 'borrower_comment') {
        if (data?.loanId) {
          router.push(`/(main)/loans/${data.loanId}`);
        }
      }
    });

    // Cleanup
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  if (!isInitialized) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ToastProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(main)" />
        </Stack>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
