import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { calculateLoanPayment, calculateEndDate } from '../../../services/calculations';
import { getOrCreateBorrower, createLoan, getPaymentsByLoan } from '../../../services/supabase';
import { schedulePaymentReminders } from '../../../services/notifications';
import { useAuthStore, usePreferencesStore } from '../../../store';
import { useToast } from '../../../components';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

// Función para obtener un color aleatorio de la paleta
const getRandomLoanColor = () => {
  const randomIndex = Math.floor(Math.random() * colors.loanColors.length);
  return colors.loanColors[randomIndex];
};
import { TermType, InterestType, LatePenaltyType, CurrencyType } from '../../../types';

export default function CreateLoanScreen() {
  // Hooks de stores primero
  const { user } = useAuthStore();
  const { defaultCurrency } = usePreferencesStore();
  const { showSuccess, showError } = useToast();

  // Estados
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Datos del prestatario
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerDni, setBorrowerDni] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');

  // Datos del préstamo
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termValue, setTermValue] = useState('');
  const [termType, setTermType] = useState<TermType>('months');
  const [interestType, setInterestType] = useState<InterestType>('simple');
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);

  // Configuración de penalización por mora
  const [latePenaltyType, setLatePenaltyType] = useState<LatePenaltyType>('none');
  const [gracePeriodDays, setGracePeriodDays] = useState('7');
  const [latePenaltyRate, setLatePenaltyRate] = useState('5');

  // Cálculos
  const calculatedPayment = () => {
    if (!principal || !interestRate || !termValue) return null;

    const result = calculateLoanPayment({
      principalAmount: parseFloat(principal),
      annualInterestRate: parseFloat(interestRate),
      termValue: parseInt(termValue),
      termType,
      interestType,
    });

    return result;
  };

  const payment = calculatedPayment();

  const handleNext = () => {
    if (step === 1) {
      if (!borrowerName.trim()) {
        showError('Error', 'Ingresa el nombre del prestatario');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!principal || !interestRate || !termValue) {
        showError('Error', 'Completa todos los campos del préstamo');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleCreate = async () => {
    if (!user || !payment) return;

    setIsLoading(true);

    try {
      // 1. Buscar prestatario existente o crear uno nuevo
      const { borrower, isNew } = await getOrCreateBorrower({
        lender_id: user.id,
        full_name: borrowerName.trim(),
        dni: borrowerDni.trim() || null,
        phone: borrowerPhone.trim() || null,
      });

      // 2. Calcular fechas
      const today = new Date();
      const deliveryDate = today.toISOString().split('T')[0];

      // Primera cuota: 1 mes o 1 semana desde hoy
      const firstPaymentDate = new Date(today);
      if (termType === 'months') {
        firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
      } else {
        firstPaymentDate.setDate(firstPaymentDate.getDate() + 7);
      }

      // Fecha de fin
      const endDate = calculateEndDate(
        firstPaymentDate,
        parseInt(termValue),
        termType
      );

      // 3. Crear el préstamo con color pastel aleatorio
      const currencySymbol = currency === 'ARS' ? '$' : 'US$';
      const newLoan = await createLoan({
        lender_id: user.id,
        borrower_id: borrower.id,
        principal_amount: parseFloat(principal),
        interest_rate: parseFloat(interestRate),
        term_value: parseInt(termValue),
        term_type: termType,
        interest_type: interestType,
        currency: currency,
        payment_amount: payment.paymentAmount,
        total_interest: payment.totalInterest,
        total_amount: payment.totalAmount,
        delivery_date: deliveryDate,
        first_payment_date: firstPaymentDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        grace_period_days: latePenaltyType !== 'none' ? parseInt(gracePeriodDays) : 0,
        late_penalty_rate: latePenaltyType !== 'none' ? parseFloat(latePenaltyRate) : 0,
        late_penalty_type: latePenaltyType,
        color_code: getRandomLoanColor(),
      });

      // 4. Programar notificaciones de recordatorio para cada cuota
      try {
        const payments = await getPaymentsByLoan(newLoan.id);
        if (payments.length > 0) {
          await schedulePaymentReminders(
            newLoan.id,
            borrowerName.trim(),
            payments.map(p => ({
              id: p.id,
              dueDate: p.due_date,
              amount: p.total_amount,
              paymentNumber: p.payment_number,
            })),
            newLoan.reminder_days_before || 3
          );
        }
      } catch (notifError) {
        // Si fallan las notificaciones, no bloqueamos la creación del préstamo
        console.warn('No se pudieron programar las notificaciones:', notifError);
      }

      const message = isNew
        ? `Préstamo de ${currencySymbol}${principal} para ${borrowerName}`
        : `Nuevo préstamo de ${currencySymbol}${principal} agregado a ${borrowerName}`;
      showSuccess('Préstamo creado', message);

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear el préstamo';
      showError('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Nuevo Préstamo</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Indicador de pasos */}
      <View style={styles.steps}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.stepIndicator,
              s <= step && styles.stepIndicatorActive,
            ]}
          >
            <Text
              style={[
                styles.stepText,
                s <= step && styles.stepTextActive,
              ]}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Paso 1: Datos del prestatario */}
        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Datos del Prestatario</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del prestatario"
                placeholderTextColor={colors.text.disabled}
                value={borrowerName}
                onChangeText={setBorrowerName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>DNI</Text>
              <TextInput
                style={styles.input}
                placeholder="12345678"
                placeholderTextColor={colors.text.disabled}
                value={borrowerDni}
                onChangeText={setBorrowerDni}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Teléfono</Text>
              <TextInput
                style={styles.input}
                placeholder="+54 9 11..."
                placeholderTextColor={colors.text.disabled}
                value={borrowerPhone}
                onChangeText={setBorrowerPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        {/* Paso 2: Detalles del préstamo */}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Detalles del Préstamo</Text>

            {/* Selector de moneda */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Moneda</Text>
              <View style={styles.currencyContainer}>
                <TouchableOpacity
                  style={[
                    styles.currencyButton,
                    currency === 'ARS' && styles.currencyButtonActive,
                  ]}
                  onPress={() => setCurrency('ARS')}
                >
                  <Text style={styles.currencyFlag}>🇦🇷</Text>
                  <Text
                    style={[
                      styles.currencyText,
                      currency === 'ARS' && styles.currencyTextActive,
                    ]}
                  >
                    Pesos (ARS)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.currencyButton,
                    currency === 'USD' && styles.currencyButtonActive,
                  ]}
                  onPress={() => setCurrency('USD')}
                >
                  <Text style={styles.currencyFlag}>🇺🇸</Text>
                  <Text
                    style={[
                      styles.currencyText,
                      currency === 'USD' && styles.currencyTextActive,
                    ]}
                  >
                    Dólares (USD)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monto a prestar ({currency === 'ARS' ? '$' : 'US$'}) *</Text>
              <TextInput
                style={styles.input}
                placeholder="5000"
                placeholderTextColor={colors.text.disabled}
                value={principal}
                onChangeText={setPrincipal}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tasa de interés anual (%) *</Text>
              <TextInput
                style={styles.input}
                placeholder="24"
                placeholderTextColor={colors.text.disabled}
                value={interestRate}
                onChangeText={setInterestRate}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Plazo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="6"
                  placeholderTextColor={colors.text.disabled}
                  value={termValue}
                  onChangeText={setTermValue}
                  keyboardType="number-pad"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Tipo</Text>
                <View style={styles.termTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.termTypeButton,
                      termType === 'months' && styles.termTypeButtonActive,
                    ]}
                    onPress={() => setTermType('months')}
                  >
                    <Text
                      style={[
                        styles.termTypeText,
                        termType === 'months' && styles.termTypeTextActive,
                      ]}
                    >
                      Meses
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.termTypeButton,
                      termType === 'weeks' && styles.termTypeButtonActive,
                    ]}
                    onPress={() => setTermType('weeks')}
                  >
                    <Text
                      style={[
                        styles.termTypeText,
                        termType === 'weeks' && styles.termTypeTextActive,
                      ]}
                    >
                      Semanas
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Selector de tipo de interés */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tipo de interés</Text>
              <View style={styles.interestTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.interestTypeButton,
                    interestType === 'simple' && styles.interestTypeButtonActive,
                  ]}
                  onPress={() => setInterestType('simple')}
                >
                  <Text
                    style={[
                      styles.interestTypeText,
                      interestType === 'simple' && styles.interestTypeTextActive,
                    ]}
                  >
                    Simple
                  </Text>
                  <Text style={[
                    styles.interestTypeDesc,
                    interestType === 'simple' && styles.interestTypeDescActive,
                  ]}>
                    Interés fijo sobre capital
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.interestTypeButton,
                    interestType === 'french' && styles.interestTypeButtonActive,
                  ]}
                  onPress={() => setInterestType('french')}
                >
                  <Text
                    style={[
                      styles.interestTypeText,
                      interestType === 'french' && styles.interestTypeTextActive,
                    ]}
                  >
                    Francés
                  </Text>
                  <Text style={[
                    styles.interestTypeDesc,
                    interestType === 'french' && styles.interestTypeDescActive,
                  ]}>
                    Cuota fija, interés sobre saldo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Configuración de penalización por mora */}
            <View style={styles.penaltySection}>
              <Text style={styles.penaltySectionTitle}>Penalización por mora</Text>
              <Text style={styles.penaltySectionDesc}>
                Configura qué sucede si el prestatario no paga a tiempo
              </Text>

              <View style={styles.penaltyTypeGrid}>
                <TouchableOpacity
                  style={[
                    styles.penaltyTypeButton,
                    latePenaltyType === 'none' && styles.penaltyTypeButtonActive,
                  ]}
                  onPress={() => setLatePenaltyType('none')}
                >
                  <Text style={[
                    styles.penaltyTypeText,
                    latePenaltyType === 'none' && styles.penaltyTypeTextActive,
                  ]}>Sin mora</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.penaltyTypeButton,
                    latePenaltyType === 'fixed' && styles.penaltyTypeButtonActive,
                  ]}
                  onPress={() => setLatePenaltyType('fixed')}
                >
                  <Text style={[
                    styles.penaltyTypeText,
                    latePenaltyType === 'fixed' && styles.penaltyTypeTextActive,
                  ]}>Fijo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.penaltyTypeButton,
                    latePenaltyType === 'daily' && styles.penaltyTypeButtonActive,
                  ]}
                  onPress={() => setLatePenaltyType('daily')}
                >
                  <Text style={[
                    styles.penaltyTypeText,
                    latePenaltyType === 'daily' && styles.penaltyTypeTextActive,
                  ]}>Por día</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.penaltyTypeButton,
                    latePenaltyType === 'weekly' && styles.penaltyTypeButtonActive,
                  ]}
                  onPress={() => setLatePenaltyType('weekly')}
                >
                  <Text style={[
                    styles.penaltyTypeText,
                    latePenaltyType === 'weekly' && styles.penaltyTypeTextActive,
                  ]}>Por semana</Text>
                </TouchableOpacity>
              </View>

              {latePenaltyType !== 'none' && (
                <View style={styles.penaltyConfig}>
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Días de gracia</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="7"
                        placeholderTextColor={colors.text.disabled}
                        value={gracePeriodDays}
                        onChangeText={setGracePeriodDays}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.inputHint}>
                        Días después del vencimiento antes de aplicar mora
                      </Text>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Tasa de mora (%)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="5"
                        placeholderTextColor={colors.text.disabled}
                        value={latePenaltyRate}
                        onChangeText={setLatePenaltyRate}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.inputHint}>
                        {latePenaltyType === 'fixed' && 'Se aplica una vez'}
                        {latePenaltyType === 'daily' && 'Se aplica por cada día de atraso'}
                        {latePenaltyType === 'weekly' && 'Se aplica por cada semana de atraso'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Vista previa del cálculo */}
            {payment && (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Vista previa {currency === 'USD' ? '(USD)' : '(ARS)'}</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    Interés {termType === 'months' ? 'mensual' : 'semanal'}:
                  </Text>
                  <Text style={styles.previewValue}>
                    {(payment.periodicRate * 100).toFixed(2)}% ({currency === 'ARS' ? '$' : 'US$'}{(parseFloat(principal) * payment.periodicRate).toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Cuota:</Text>
                  <Text style={styles.previewValue}>
                    {currency === 'ARS' ? '$' : 'US$'}{payment.paymentAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total intereses:</Text>
                  <Text style={styles.previewValue}>
                    {currency === 'ARS' ? '$' : 'US$'}{payment.totalInterest.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Total a pagar:</Text>
                  <Text style={[styles.previewValue, styles.previewValueHighlight]}>
                    {currency === 'ARS' ? '$' : 'US$'}{payment.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Paso 3: Confirmación */}
        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Confirmar Préstamo</Text>

            <View style={styles.confirmCard}>
              <Text style={styles.confirmLabel}>Prestatario</Text>
              <Text style={styles.confirmValue}>{borrowerName}</Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Moneda</Text>
              <Text style={styles.confirmValue}>
                {currency === 'ARS' ? '🇦🇷 Pesos Argentinos' : '🇺🇸 Dólares'}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Capital</Text>
              <Text style={styles.confirmValue}>
                {currency === 'ARS' ? '$' : 'US$'}{principal}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Interés</Text>
              <Text style={styles.confirmValue}>{interestRate}% anual</Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Tipo de cálculo</Text>
              <Text style={styles.confirmValue}>
                {interestType === 'simple' ? 'Simple (interés fijo)' : 'Francés (cuota fija)'}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Plazo</Text>
              <Text style={styles.confirmValue}>
                {termValue} {termType === 'months' ? 'meses' : 'semanas'}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Cuota</Text>
              <Text style={[styles.confirmValue, styles.confirmValueHighlight]}>
                {currency === 'ARS' ? '$' : 'US$'}{payment?.paymentAmount.toFixed(2)} / {termType === 'months' ? 'mes' : 'semana'}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Total a pagar</Text>
              <Text style={[styles.confirmValue, styles.confirmValueHighlight]}>
                {currency === 'ARS' ? '$' : 'US$'}{payment?.totalAmount.toFixed(2)}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Penalización por mora</Text>
              <Text style={styles.confirmValue}>
                {latePenaltyType === 'none' && 'Sin penalización'}
                {latePenaltyType === 'fixed' && `${latePenaltyRate}% fijo (${gracePeriodDays} días de gracia)`}
                {latePenaltyType === 'daily' && `${latePenaltyRate}% por día (${gracePeriodDays} días de gracia)`}
                {latePenaltyType === 'weekly' && `${latePenaltyRate}% por semana (${gracePeriodDays} días de gracia)`}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Botones de acción */}
      <View style={styles.actions}>
        {step < 3 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Crear Préstamo</Text>
            )}
          </TouchableOpacity>
        )}
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
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorActive: {
    backgroundColor: colors.primary.main,
  },
  stepText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text.secondary,
  },
  stepTextActive: {
    color: colors.text.inverse,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  form: {
    marginTop: spacing.md,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  termTypeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  termTypeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  termTypeButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  termTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  termTypeTextActive: {
    color: colors.text.inverse,
  },
  interestTypeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  interestTypeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  interestTypeButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  interestTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  interestTypeTextActive: {
    color: colors.text.inverse,
  },
  interestTypeDesc: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  interestTypeDescActive: {
    color: colors.text.inverse,
    opacity: 0.8,
  },
  preview: {
    backgroundColor: colors.primary.main + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  previewTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.primary.main,
    marginBottom: spacing.sm,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  previewLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  previewValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  previewValueHighlight: {
    color: colors.primary.main,
    fontWeight: fontWeight.bold,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadow.md,
  },
  confirmLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  confirmValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  confirmValueHighlight: {
    color: colors.primary.main,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  actions: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  penaltySection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  penaltySectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  penaltySectionDesc: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  penaltyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  penaltyTypeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  penaltyTypeButtonActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  penaltyTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  penaltyTypeTextActive: {
    color: colors.text.inverse,
  },
  penaltyConfig: {
    marginTop: spacing.md,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  currencyContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  currencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  currencyFlag: {
    fontSize: fontSize.xl,
  },
  currencyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  currencyTextActive: {
    color: colors.text.inverse,
  },
});
