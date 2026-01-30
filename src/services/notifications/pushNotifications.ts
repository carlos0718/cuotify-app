import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Solicita permisos y registra el dispositivo para push notifications
 * @returns El Expo Push Token o null si falló
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Solo funciona en dispositivos físicos
  if (!Device.isDevice) {
    console.log('Push notifications solo funcionan en dispositivos físicos');
    return null;
  }

  try {
    // Verificar permisos existentes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tenemos permisos, solicitarlos
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // Si el usuario no otorgó permisos, salir
    if (finalStatus !== 'granted') {
      console.log('Permisos de notificación denegados');
      return null;
    }

    // Obtener el token de Expo Push
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'fa89e9e4-8756-43d0-b325-653ffe6a66c2', // Tu project ID de Expo
    });

    const token = tokenData.data;
    console.log('Push token obtenido:', token);

    // Configurar canal de notificaciones en Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });

      // Canal para recordatorios de pago
      await Notifications.setNotificationChannelAsync('payment_reminders', {
        name: 'Recordatorios de pago',
        description: 'Notificaciones sobre pagos próximos a vencer',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F59E0B',
      });

      // Canal para pagos vencidos
      await Notifications.setNotificationChannelAsync('payment_overdue', {
        name: 'Pagos vencidos',
        description: 'Alertas de pagos atrasados',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#EF4444',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registrando push notifications:', error);
    return null;
  }
}

/**
 * Guarda el push token en Supabase para el usuario actual
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    const deviceType: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

    // Verificar si ya existe este token
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle();

    const existingRecord = existing as { id: string } | null;

    if (existingRecord) {
      // Actualizar el token existente como activo
      await supabase
        .from('push_tokens')
        .update({ is_active: true, updated_at: new Date().toISOString() } as never)
        .eq('id', existingRecord.id);
    } else {
      // Desactivar tokens anteriores del usuario
      await supabase
        .from('push_tokens')
        .update({ is_active: false } as never)
        .eq('user_id', userId);

      // Insertar nuevo token
      await supabase
        .from('push_tokens')
        .insert({
          user_id: userId,
          token,
          device_type: deviceType,
          is_active: true,
        } as never);
    }

    console.log('Push token guardado en Supabase');
    return true;
  } catch (error) {
    console.error('Error guardando push token:', error);
    return false;
  }
}

/**
 * Programa una notificación local (para recordatorios)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, unknown>
): Promise<string | null> {
  try {
    // Calcular segundos hasta la fecha del trigger
    const secondsUntilTrigger = Math.max(
      1,
      Math.floor((triggerDate.getTime() - Date.now()) / 1000)
    );

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        seconds: secondsUntilTrigger,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });

    console.log('Notificación programada:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error programando notificación:', error);
    return null;
  }
}

/**
 * Cancela una notificación programada
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('Notificación cancelada:', notificationId);
  } catch (error) {
    console.error('Error cancelando notificación:', error);
  }
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones canceladas');
  } catch (error) {
    console.error('Error cancelando notificaciones:', error);
  }
}

/**
 * Obtiene el badge count actual (iOS)
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Establece el badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

// Tipo para la suscripción de notificaciones
type NotificationSubscription = { remove: () => void };

/**
 * Listener para cuando se recibe una notificación (app en primer plano)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): NotificationSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Listener para cuando el usuario toca una notificación
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): NotificationSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Programa recordatorios de pago para un préstamo
 */
export async function schedulePaymentReminders(
  loanId: string,
  borrowerName: string,
  payments: Array<{ id: string; dueDate: string; amount: number; paymentNumber: number }>,
  reminderDaysBefore: number = 3
): Promise<void> {
  for (const payment of payments) {
    const dueDate = new Date(payment.dueDate);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - reminderDaysBefore);

    // Solo programar si la fecha de recordatorio es futura
    if (reminderDate > new Date()) {
      await scheduleLocalNotification(
        `Cuota #${payment.paymentNumber} - ${borrowerName}`,
        `Vence en ${reminderDaysBefore} días. Monto: $${payment.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        reminderDate,
        {
          type: 'payment_reminder',
          loanId,
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
        }
      );
    }
  }

  console.log(`Programadas ${payments.length} notificaciones para ${borrowerName}`);
}
