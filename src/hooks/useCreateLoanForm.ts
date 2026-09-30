import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { calculateLoanPayment, calculateEndDate } from '../services/calculations';
import {
  getOrCreateBorrower,
  createLoan,
  getPaymentsByLoan,
  getLastLoanColor,
  uploadTransferProof,
  getActiveLoans,
} from '../services/supabase';
import { schedulePaymentReminders } from '../services/notifications';
import { useAuthStore, usePreferencesStore, useSubscriptionStore, FREE_LIMITS } from '../store';
import { useToast } from '../components';
import { getNextLoanColor } from '../utils';
import { TermType, InterestType, LatePenaltyType, CurrencyType } from '../types';

export function useCreateLoanForm() {
  // Hooks de stores primero
  const { user } = useAuthStore();
  const { defaultCurrency, reminderDaysBefore } = usePreferencesStore();
  const { premium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  // Estados
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });

  // Datos del prestatario
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerDni, setBorrowerDni] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [transferProofUri, setTransferProofUri] = useState<string | null>(null);

  // Datos del préstamo
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termValue, setTermValue] = useState('');
  const [termType, setTermType] = useState<TermType>('months');
  const [interestType, setInterestType] = useState<InterestType>('simple');
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [deliveryDateInput, setDeliveryDateInput] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Calcula automáticamente el primer pago según termType
  const firstPaymentDateCalc = (() => {
    if (!deliveryDateInput || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateInput)) return '';
    const d = new Date(deliveryDateInput + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    if (termType === 'months') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    return d.toISOString().split('T')[0];
  })();

  const [showInterestGuide, setShowInterestGuide] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Configuración de penalización por mora
  const [latePenaltyType, setLatePenaltyType] = useState<LatePenaltyType>('none');
  const [gracePeriodDays, setGracePeriodDays] = useState('7');
  const [latePenaltyRate, setLatePenaltyRate] = useState('5');

  // Cálculos
  const calculatedPayment = () => {
    if (!principal || !interestRate || !termValue) return null;

    const result = calculateLoanPayment({
      principalAmount: parseFloat(principal),
      annualInterestRate: parseFloat(interestRate) * 12,
      termValue: parseInt(termValue),
      termType,
      interestType,
    });

    return result;
  };

  const payment = calculatedPayment();

  const handlePickImage = () => {
    Alert.alert(
      'Adjuntar comprobante',
      'Seleccioná el origen de la imagen',
      [
        { text: 'Cámara', onPress: openCamera },
        { text: 'Galería', onPress: openGallery },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError('Permiso requerido', 'Necesitamos acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setTransferProofUri(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permiso requerido', 'Necesitamos acceso a la galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setTransferProofUri(result.assets[0].uri);
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!borrowerName.trim()) {
      newErrors.borrowerName = 'El nombre es obligatorio';
    } else if (borrowerName.trim().length < 2) {
      newErrors.borrowerName = 'Ingresá al menos 2 caracteres';
    }
    if (borrowerDni && !/^\d{7,8}$/.test(borrowerDni.replace(/\D/g, ''))) {
      newErrors.borrowerDni = 'El DNI debe tener 7 u 8 dígitos';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    const p = parseFloat(principal);
    if (!principal.trim()) {
      newErrors.principal = 'El monto es obligatorio';
    } else if (isNaN(p) || p <= 0) {
      newErrors.principal = 'Ingresá un monto mayor a 0';
    }
    const r = parseFloat(interestRate);
    if (!interestRate.trim()) {
      newErrors.interestRate = 'La tasa de interés es obligatoria';
    } else if (isNaN(r) || r < 0) {
      newErrors.interestRate = 'Ingresá una tasa válida (≥ 0)';
    } else if (r > 999) {
      newErrors.interestRate = 'La tasa parece muy alta, verificá';
    }
    if (interestType !== 'open') {
      const t = parseInt(termValue);
      if (!termValue.trim()) {
        newErrors.termValue = 'El plazo es obligatorio';
      } else if (isNaN(t) || t <= 0) {
        newErrors.termValue = 'Ingresá un plazo mayor a 0';
      }
    }
    if (!deliveryDateInput.trim()) {
      newErrors.deliveryDate = 'La fecha es obligatoria';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateInput)) {
      newErrors.deliveryDate = 'Formato incorrecto, usá AAAA-MM-DD';
    } else if (isNaN(new Date(deliveryDateInput + 'T12:00:00').getTime())) {
      newErrors.deliveryDate = 'La fecha ingresada no es válida';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setErrors({});
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (interestType !== 'open' && !payment) return;

    // Verificar límite de plan gratuito
    if (!premium) {
      const activeLoans = await getActiveLoans();
      if (activeLoans.length >= FREE_LIMITS.activeLoans) {
        router.push('/(main)/settings/premium');
        return;
      }
    }

    setIsLoading(true);

    try {
      // 1. Buscar prestatario existente o crear uno nuevo
      const { borrower, isNew } = await getOrCreateBorrower({
        lender_id: user.id,
        full_name: borrowerName.trim(),
        dni: borrowerDni.trim() || null,
        phone: borrowerPhone.trim() || null,
      });

      // 2. Calcular fechas a partir de la fecha de préstamo ingresada
      const deliveryDate = deliveryDateInput;
      const firstPaymentDate = new Date(firstPaymentDateCalc + 'T12:00:00');

      // Fecha de fin (null para préstamos abiertos)
      const endDate = interestType !== 'open'
        ? calculateEndDate(firstPaymentDate, parseInt(termValue), termType)
        : null;

      // 3. Obtener el siguiente color (diferente al último préstamo)
      const lastColor = await getLastLoanColor();
      const loanColor = getNextLoanColor(lastColor);

      // 4. Subir comprobante si existe
      let transferProofUrl: string | null = null;
      if (transferProofUri) {
        try {
          transferProofUrl = await uploadTransferProof(transferProofUri);
        } catch {
          // No bloquear la creación si falla la subida
        }
      }

      // 5. Crear el préstamo con color pastel secuencial
      const currencySymbol = currency === 'ARS' ? '$' : 'US$';
      const isOpen = interestType === 'open';
      const newLoan = await createLoan({
        lender_id: user.id,
        borrower_id: borrower.id,
        principal_amount: parseFloat(principal),
        interest_rate: parseFloat(interestRate) * 12,
        term_value: isOpen ? null : parseInt(termValue),
        term_type: termType,
        interest_type: interestType,
        currency: currency,
        payment_amount: isOpen ? 0 : (payment?.paymentAmount ?? 0),
        total_interest: isOpen ? 0 : (payment?.totalInterest ?? 0),
        total_amount: isOpen ? parseFloat(principal) : (payment?.totalAmount ?? 0),
        delivery_date: deliveryDate,
        first_payment_date: firstPaymentDate.toISOString().split('T')[0],
        end_date: endDate ? endDate.toISOString().split('T')[0] : null,
        grace_period_days: latePenaltyType !== 'none' ? parseInt(gracePeriodDays) : 0,
        late_penalty_rate: latePenaltyType !== 'none' ? parseFloat(latePenaltyRate) : 0,
        late_penalty_type: latePenaltyType,
        color_code: loanColor,
        notes: notes.trim() || null,
        transfer_proof_url: transferProofUrl,
      });

      // 5. Programar notificaciones de recordatorio para cada cuota
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
            reminderDaysBefore
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

  return {
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
    validateStep1,
    validateStep2,
    handleNext,
    handleBack,
    handleCreate,
  };
}
