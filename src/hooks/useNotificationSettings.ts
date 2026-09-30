import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { usePreferencesStore } from '../store';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getActiveLoans,
  getPaymentsByLoan,
  getActivePersonalDebts,
  getDebtPayments,
} from '../services/supabase';
import {
  cancelAllScheduledNotifications,
  schedulePaymentReminders,
  scheduleDebtPaymentReminders,
  scheduleLocalNotification,
  updateBadgeCount,
} from '../services/notifications';
import { useToast } from '../components';

export function useNotificationSettings() {
  const {
    reminderDaysBefore,
    pushEnabled,
    setReminderDaysBefore,
    setPushEnabled,
  } = usePreferencesStore();

  const { showSuccess, showError } = useToast();

  const [localDays, setLocalDays] = useState(reminderDaysBefore);
  const [localPush, setLocalPush] = useState(pushEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Cargar preferencias desde Supabase al montar (sincroniza dispositivos)
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const prefs = await getNotificationPreferences();
        if (prefs) {
          setLocalDays(prefs.reminder_days_before);
          setLocalPush(prefs.push_enabled);
          setReminderDaysBefore(prefs.reminder_days_before);
          setPushEnabled(prefs.push_enabled);
        }
      } catch {
        // Si falla, usar los valores del store local
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Solo en desarrollo ──────────────────────────────────────────────────
  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      // 1. Verificar permisos
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert(
            'Sin permisos',
            `Estado del permiso: "${newStatus}"\n\nAndá a Ajustes del iPhone → Expo Go → Notificaciones y activá los permisos.`
          );
          return;
        }
      }

      // 2. Programar notificación en 5 segundos
      const notifId = await scheduleLocalNotification(
        '🧪 Notificación de prueba',
        'Las notificaciones locales funcionan correctamente.',
        new Date(Date.now() + 5000),
        { type: 'dev_test' }
      );

      if (!notifId) {
        Alert.alert('Error', 'scheduleLocalNotification devolvió null. Revisá la consola para más detalles.');
        return;
      }

      await updateBadgeCount();

      Alert.alert(
        'Listo ✓',
        `Notificación programada (ID: ${notifId.slice(0, 8)}...)\n\nMinimizá la app ahora — aparece en 5 segundos.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error inesperado', e instanceof Error ? e.message : String(e));
    } finally {
      setIsTesting(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveNotificationPreferences({
        reminder_days_before: localDays,
        push_enabled: localPush,
      });
      // Actualizar store local
      setReminderDaysBefore(localDays);
      setPushEnabled(localPush);

      // Reprogramar todas las notificaciones locales con la nueva configuración
      await cancelAllScheduledNotifications();
      const [loans, debts] = await Promise.all([getActiveLoans(), getActivePersonalDebts()]);
      await Promise.all([
        ...loans.map(async (loan: { id: string; borrower?: { full_name?: string } }) => {
          const payments = await getPaymentsByLoan(loan.id);
          await schedulePaymentReminders(
            loan.id,
            loan.borrower?.full_name ?? 'Prestatario',
            payments.map((p: { id: string; due_date: string; total_amount: number; payment_number: number }) => ({
              id: p.id,
              dueDate: p.due_date,
              amount: p.total_amount,
              paymentNumber: p.payment_number,
            })),
            localDays
          );
        }),
        ...debts.map(async (debt: { id: string; creditor_name: string }) => {
          const payments = await getDebtPayments(debt.id);
          await scheduleDebtPaymentReminders(
            debt.id,
            debt.creditor_name,
            payments.map((p: { id: string; due_date: string; total_amount: number; payment_number: number }) => ({
              id: p.id,
              dueDate: p.due_date,
              amount: p.total_amount,
              paymentNumber: p.payment_number,
            })),
            localDays
          );
        }),
      ]);

      showSuccess('Guardado', 'Tus preferencias de notificación han sido actualizadas');
      router.back();
    } catch {
      showError('Error', 'No se pudieron guardar las preferencias');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    localDays,
    setLocalDays,
    localPush,
    setLocalPush,
    isLoading,
    isSaving,
    isTesting,
    handleTestNotification,
    handleSave,
  };
}
