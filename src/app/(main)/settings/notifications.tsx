import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { usePreferencesStore } from '../../../store';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getActiveLoans,
  getPaymentsByLoan,
  getActivePersonalDebts,
  getDebtPayments,
} from '../../../services/supabase';
import {
  cancelAllScheduledNotifications,
  schedulePaymentReminders,
  scheduleDebtPaymentReminders,
  scheduleLocalNotification,
  updateBadgeCount,
} from '../../../services/notifications';
import { useToast } from '../../../components';

export default function NotificationSettingsScreen() {
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Notificaciones</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notificaciones</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Canales de notificación */}
        <Text style={styles.sectionTitle}>Canales</Text>
        <View style={styles.section}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Notificaciones push</Text>
              <Text style={styles.settingDescription}>
                Recibe alertas en tu dispositivo aunque la app esté cerrada
              </Text>
            </View>
            <Switch
              value={localPush}
              onValueChange={setLocalPush}
              trackColor={{ false: colors.border, true: colors.primary.main + '50' }}
              thumbColor={localPush ? colors.primary.main : colors.text.disabled}
            />
          </View>
        </View>

        {/* Días de recordatorio */}
        <Text style={styles.sectionTitle}>Recordatorios de pago</Text>
        <View style={styles.section}>
          <Text style={styles.reminderLabel}>
            Días antes del vencimiento para recibir recordatorio
          </Text>
          <View style={styles.reminderOptions}>
            {[1, 3, 5, 7, 10].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.reminderOption,
                  localDays === days && styles.reminderOptionActive,
                ]}
                onPress={() => setLocalDays(days)}
              >
                <Text
                  style={[
                    styles.reminderOptionText,
                    localDays === days && styles.reminderOptionTextActive,
                  ]}
                >
                  {days}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.reminderHint}>
            Recibirás una notificación {localDays} {localDays === 1 ? 'día' : 'días'} antes del
            vencimiento de cada cuota, tanto de préstamos como de deudas personales.
          </Text>
        </View>

        {/* Tipos de notificación */}
        <Text style={styles.sectionTitle}>Tipos de alerta</Text>
        <View style={styles.section}>
          {[
            { icon: '🔔', title: 'Recordatorios de pago', desc: 'Antes del vencimiento de cada cuota' },
            { icon: '⚠️', title: 'Pagos vencidos', desc: 'Cuando un pago supera la fecha límite' },
            { icon: '✓', title: 'Pagos recibidos', desc: 'Cuando se registra un pago' },
            { icon: '💬', title: 'Comentarios', desc: 'Cuando alguien comenta en una cuota' },
          ].map((item, i, arr) => (
            <View
              key={item.title}
              style={[styles.alertItem, i === arr.length - 1 && { borderBottomWidth: 0 }]}
            >
              <Text style={styles.alertIcon}>{item.icon}</Text>
              <View style={styles.alertInfo}>
                <Text style={styles.alertTitle}>{item.title}</Text>
                <Text style={styles.alertDescription}>{item.desc}</Text>
              </View>
              <Text style={styles.alertStatus}>Activo</Text>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Botón de guardar */}
      <View style={styles.actions}>
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.testButton, isTesting && styles.saveButtonDisabled]}
            onPress={handleTestNotification}
            disabled={isTesting}
          >
            {isTesting ? (
              <ActivityIndicator color={colors.warning} size="small" />
            ) : (
              <Text style={styles.testButtonText}>🧪 Probar notificación (dev)</Text>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar preferencias</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 70,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadow.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  reminderLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  reminderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  reminderOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  reminderOptionActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  reminderOptionText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
  },
  reminderOptionTextActive: {
    color: colors.text.inverse,
  },
  reminderHint: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    lineHeight: 18,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  alertIcon: {
    fontSize: fontSize.lg,
    marginRight: spacing.md,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  alertDescription: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  alertStatus: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.success,
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  testButton: {
    borderWidth: 1.5,
    borderColor: colors.warning,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  testButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.warning,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
});
