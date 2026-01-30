import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

export default function NotificationSettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(5);

  const handleSave = () => {
    Alert.alert('Guardado', 'Tus preferencias de notificación han sido actualizadas');
    router.back();
  };

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
                Recibe alertas en tu dispositivo
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: colors.border, true: colors.primary.main + '50' }}
              thumbColor={pushEnabled ? colors.primary.main : colors.text.disabled}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Notificaciones por email</Text>
              <Text style={styles.settingDescription}>
                Recibe resúmenes en tu correo
              </Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={setEmailEnabled}
              trackColor={{ false: colors.border, true: colors.primary.main + '50' }}
              thumbColor={emailEnabled ? colors.primary.main : colors.text.disabled}
            />
          </View>
        </View>

        {/* Días de recordatorio */}
        <Text style={styles.sectionTitle}>Recordatorios de pago</Text>
        <View style={styles.section}>
          <Text style={styles.reminderLabel}>
            Días antes del vencimiento para enviar recordatorio
          </Text>
          <View style={styles.reminderOptions}>
            {[1, 3, 5, 7, 10].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.reminderOption,
                  reminderDays === days && styles.reminderOptionActive,
                ]}
                onPress={() => setReminderDays(days)}
              >
                <Text
                  style={[
                    styles.reminderOptionText,
                    reminderDays === days && styles.reminderOptionTextActive,
                  ]}
                >
                  {days}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.reminderHint}>
            Recibirás recordatorios diarios desde {reminderDays} días antes hasta
            que el pago sea marcado como completado.
          </Text>
        </View>

        {/* Tipos de notificación */}
        <Text style={styles.sectionTitle}>Tipos de alerta</Text>
        <View style={styles.section}>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>🔔</Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>Recordatorios de pago</Text>
              <Text style={styles.alertDescription}>
                Antes del vencimiento de cada cuota
              </Text>
            </View>
            <Text style={styles.alertStatus}>Activo</Text>
          </View>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>⚠️</Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>Pagos vencidos</Text>
              <Text style={styles.alertDescription}>
                Cuando un pago supera la fecha límite
              </Text>
            </View>
            <Text style={styles.alertStatus}>Activo</Text>
          </View>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>✓</Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>Pagos recibidos</Text>
              <Text style={styles.alertDescription}>
                Cuando se registra un pago
              </Text>
            </View>
            <Text style={styles.alertStatus}>Activo</Text>
          </View>
          <View style={styles.alertItem}>
            <Text style={styles.alertIcon}>💬</Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>Comentarios</Text>
              <Text style={styles.alertDescription}>
                Cuando alguien comenta en una cuota
              </Text>
            </View>
            <Text style={styles.alertStatus}>Activo</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Botón de guardar */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Guardar preferencias</Text>
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
  saveButton: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
});
