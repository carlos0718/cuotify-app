import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { PhoneInput, Modal } from '../../../components';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { useCreateLoanForm } from '../../../hooks';

export default function CreateLoanScreen() {
  const {
    step,
    isLoading,
    errors,
    clearError,
    borrowerName,
    setBorrowerName,
    borrowerDni,
    setBorrowerDni,
    borrowerPhone,
    setBorrowerPhone,
    transferProofUri,
    setTransferProofUri,
    principal,
    setPrincipal,
    interestRate,
    setInterestRate,
    termValue,
    setTermValue,
    termType,
    setTermType,
    interestType,
    setInterestType,
    currency,
    setCurrency,
    deliveryDateInput,
    setDeliveryDateInput,
    notes,
    setNotes,
    firstPaymentDateCalc,
    showInterestGuide,
    setShowInterestGuide,
    showDatePicker,
    setShowDatePicker,
    latePenaltyType,
    setLatePenaltyType,
    gracePeriodDays,
    setGracePeriodDays,
    latePenaltyRate,
    setLatePenaltyRate,
    payment,
    handlePickImage,
    handleNext,
    handleBack,
    handleCreate,
  } = useCreateLoanForm();

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
                style={[styles.input, errors.borrowerName && styles.inputError]}
                placeholder="Nombre del prestatario"
                placeholderTextColor={colors.text.disabled}
                value={borrowerName}
                onChangeText={(v) => { setBorrowerName(v); clearError('borrowerName'); }}
              />
              {errors.borrowerName && <Text style={styles.errorText}>{errors.borrowerName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>DNI</Text>
              <TextInput
                style={[styles.input, errors.borrowerDni && styles.inputError]}
                placeholder="12345678"
                placeholderTextColor={colors.text.disabled}
                value={borrowerDni}
                onChangeText={(v) => { setBorrowerDni(v); clearError('borrowerDni'); }}
                keyboardType="numeric"
              />
              {errors.borrowerDni && <Text style={styles.errorText}>{errors.borrowerDni}</Text>}
            </View>

            <PhoneInput
              value={borrowerPhone}
              onChange={setBorrowerPhone}
            />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Comprobante de transferencia</Text>
              {transferProofUri ? (
                <View style={styles.proofContainer}>
                  <Image source={{ uri: transferProofUri }} style={styles.proofThumbnail} resizeMode="cover" />
                  <TouchableOpacity style={styles.proofRemoveButton} onPress={() => setTransferProofUri(null)}>
                    <Text style={styles.proofRemoveText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.proofPickerButton} onPress={handlePickImage}>
                  <Text style={styles.proofPickerIcon}>📎</Text>
                  <Text style={styles.proofPickerText}>Adjuntar comprobante (opcional)</Text>
                </TouchableOpacity>
              )}
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
                style={[styles.input, errors.principal && styles.inputError]}
                placeholder="5000"
                placeholderTextColor={colors.text.disabled}
                value={principal}
                onChangeText={(v) => { setPrincipal(v); clearError('principal'); }}
                keyboardType="decimal-pad"
              />
              {errors.principal && <Text style={styles.errorText}>{errors.principal}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tasa de interés mensual (%) *</Text>
              <TextInput
                style={[styles.input, errors.interestRate && styles.inputError]}
                placeholder="24"
                placeholderTextColor={colors.text.disabled}
                value={interestRate}
                onChangeText={(v) => { setInterestRate(v); clearError('interestRate'); }}
                keyboardType="decimal-pad"
              />
              {errors.interestRate && <Text style={styles.errorText}>{errors.interestRate}</Text>}
            </View>

            {/* Selector de tipo de interés */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Tipo de interés</Text>
                <TouchableOpacity onPress={() => setShowInterestGuide(true)} activeOpacity={0.7}>
                  <Text style={styles.infoButton}>ⓘ ¿Cuál elegir?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.interestTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.interestTypeButton,
                    interestType === 'simple' && styles.interestTypeButtonActive,
                  ]}
                  onPress={() => setInterestType('simple')}
                >
                  <Text style={[styles.interestTypeText, interestType === 'simple' && styles.interestTypeTextActive]}>
                    Simple
                  </Text>
                  <Text style={[styles.interestTypeDesc, interestType === 'simple' && styles.interestTypeDescActive]}>
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
                  <Text style={[styles.interestTypeText, interestType === 'french' && styles.interestTypeTextActive]}>
                    Francés
                  </Text>
                  <Text style={[styles.interestTypeDesc, interestType === 'french' && styles.interestTypeDescActive]}>
                    Cuota fija, interés sobre saldo
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.interestTypeButton,
                    interestType === 'open' && styles.interestTypeButtonActive,
                  ]}
                  onPress={() => setInterestType('open')}
                >
                  <Text style={[styles.interestTypeText, interestType === 'open' && styles.interestTypeTextActive]}>
                    Cuota Libre
                  </Text>
                  <Text style={[styles.interestTypeDesc, interestType === 'open' && styles.interestTypeDescActive]}>
                    Capital variable sin plazo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {interestType !== 'open' && (
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Plazo *</Text>
                <TextInput
                  style={[styles.input, errors.termValue && styles.inputError]}
                  placeholder="6"
                  placeholderTextColor={colors.text.disabled}
                  value={termValue}
                  onChangeText={(v) => { setTermValue(v); clearError('termValue'); }}
                  keyboardType="number-pad"
                />
                {errors.termValue && <Text style={styles.errorText}>{errors.termValue}</Text>}
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
            )}

            {/* Descripción opcional */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ej: Préstamo para moto, emergencia médica..."
                placeholderTextColor={colors.text.disabled}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Fecha de préstamo */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de préstamo *</Text>
              <TouchableOpacity
                style={[styles.input, styles.datePickerButton, errors.deliveryDate && styles.inputError]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={deliveryDateInput ? styles.datePickerText : styles.datePickerPlaceholder}>
                  {deliveryDateInput || 'Seleccioná una fecha'}
                </Text>
                <Text style={styles.datePickerIcon}>📅</Text>
              </TouchableOpacity>
              {errors.deliveryDate
                ? <Text style={styles.errorText}>{errors.deliveryDate}</Text>
                : <Text style={styles.inputHint}>
                    {firstPaymentDateCalc
                      ? `Primera cuota: ${firstPaymentDateCalc} (+1 ${termType === 'months' ? 'mes' : 'semana'})`
                      : 'Tocá para elegir la fecha'}
                  </Text>
              }
            </View>

            {/* Modal calendario */}
            <Modal
              visible={showDatePicker}
              onClose={() => setShowDatePicker(false)}
              title="Fecha de préstamo"
              icon="📅"
              buttons={[{ text: 'Cerrar', style: 'cancel', onPress: () => setShowDatePicker(false) }]}
            >
              <Calendar
                current={deliveryDateInput || new Date().toISOString().split('T')[0]}
                onDayPress={(day: DateData) => {
                  setDeliveryDateInput(day.dateString);
                  clearError('deliveryDate');
                  setShowDatePicker(false);
                }}
                markedDates={deliveryDateInput ? { [deliveryDateInput]: { selected: true, selectedColor: colors.primary.main } } : {}}
                theme={{
                  backgroundColor: 'transparent',
                  calendarBackground: 'transparent',
                  selectedDayBackgroundColor: colors.primary.main,
                  selectedDayTextColor: colors.text.inverse,
                  todayTextColor: colors.primary.main,
                  dayTextColor: colors.text.primary,
                  textDisabledColor: colors.text.disabled,
                  monthTextColor: colors.text.primary,
                  arrowColor: colors.primary.main,
                }}
              />
            </Modal>

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

        {/* Modal: guía de tipos de interés */}
        <Modal
          visible={showInterestGuide}
          onClose={() => setShowInterestGuide(false)}
          title="¿Qué tipo de préstamo elegir?"
          icon="📚"
          scrollable
          buttons={[{ text: 'Entendido', style: 'primary', onPress: () => setShowInterestGuide(false) }]}
        >
          <View style={{ width: '100%', marginTop: spacing.sm }}>
            {/* Simple */}
            <View style={styles.guideSection}>
              <Text style={[styles.guideSectionBadge, { backgroundColor: colors.primary.main }]}>Simple</Text>
              <Text style={styles.guideSectionTitle}>Interés fijo sobre el capital</Text>
              <Text style={styles.guideSectionDesc}>
                El interés se calcula una sola vez sobre el capital original y se divide en partes iguales entre todas las cuotas. Todas las cuotas son iguales.
              </Text>
              <Text style={styles.guideSectionExample}>
                Ej: $100.000 al 24% anual, 6 meses → interés total $12.000 → cuota fija de $18.667
              </Text>
            </View>

            <View style={styles.guideDivider} />

            {/* Francés */}
            <View style={styles.guideSection}>
              <Text style={[styles.guideSectionBadge, { backgroundColor: '#8B5CF6' }]}>Francés</Text>
              <Text style={styles.guideSectionTitle}>Cuota fija, interés decreciente</Text>
              <Text style={styles.guideSectionDesc}>
                La cuota es siempre la misma pero cambia su composición: al principio pagás más interés y menos capital; al final pagás más capital y menos interés.
              </Text>
              <Text style={styles.guideSectionExample}>
                Ej: $100.000 al 24% anual, 6 meses → cuota fija de $17.853 (interés decrece mes a mes)
              </Text>
            </View>

            <View style={styles.guideDivider} />

            {/* Cuota Libre */}
            <View style={[styles.guideSection, { marginBottom: 0 }]}>
              <Text style={[styles.guideSectionBadge, { backgroundColor: '#F59E0B' }]}>Cuota Libre</Text>
              <Text style={styles.guideSectionTitle}>Sin plazo fijo, capital variable</Text>
              <Text style={styles.guideSectionDesc}>
                Cada mes se paga el interés sobre el saldo actual. El prestatario puede abonar cualquier monto al capital. El préstamo termina cuando el saldo llega a $0.
              </Text>
              <Text style={styles.guideSectionExample}>
                Ej: $500.000 al 180% anual (15% mensual) → mes 1: solo $75.000 de interés; mes 2: $75.000 interés + $100.000 capital = $175.000; saldo nuevo: $400.000
              </Text>
            </View>
          </View>
        </Modal>

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

              {notes.trim() ? (
                <>
                  <View style={styles.confirmDivider} />
                  <Text style={styles.confirmLabel}>Descripción</Text>
                  <Text style={styles.confirmValue}>{notes.trim()}</Text>
                </>
              ) : null}

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Capital</Text>
              <Text style={styles.confirmValue}>
                {currency === 'ARS' ? '$' : 'US$'}{principal}
              </Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Interés</Text>
              <Text style={styles.confirmValue}>{interestRate}% mensual</Text>

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

              <Text style={styles.confirmLabel}>Fecha de préstamo</Text>
              <Text style={styles.confirmValue}>{deliveryDateInput}</Text>

              <View style={styles.confirmDivider} />

              <Text style={styles.confirmLabel}>Primera cuota</Text>
              <Text style={styles.confirmValue}>{firstPaymentDateCalc}</Text>

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
    textAlign: 'center',
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  infoButton: {
    fontSize: fontSize.xs,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  guideSection: {
    marginBottom: spacing.md,
  },
  guideSectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  guideSectionBadge: {
    fontSize: fontSize.xs,
    color: colors.text.inverse,
    fontWeight: fontWeight.semiBold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  guideSectionDesc: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  guideSectionExample: {
    fontSize: fontSize.xs,
    color: colors.text.disabled,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  guideDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  inputError: {
    borderColor: colors.error,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  datePickerPlaceholder: {
    fontSize: fontSize.base,
    color: colors.text.disabled,
  },
  datePickerIcon: {
    fontSize: fontSize.lg,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  proofPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
  },
  proofPickerIcon: {
    fontSize: fontSize.lg,
  },
  proofPickerText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  proofContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  proofThumbnail: {
    width: '100%',
    height: 160,
  },
  proofRemoveButton: {
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.error + '10',
  },
  proofRemoveText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },
});
