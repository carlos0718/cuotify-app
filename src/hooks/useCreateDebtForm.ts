import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { calculateLoanPayment } from '../services/calculations';
import { createPersonalDebt, getDebtPayments, getActivePersonalDebts, uploadTransferProof } from '../services/supabase';
import { scheduleDebtPaymentReminders } from '../services/notifications';
import { useSubscriptionStore, FREE_LIMITS, usePreferencesStore } from '../store';
import { useToast } from '../components';
import { TermType, InterestType, LatePenaltyType, CurrencyType } from '../types';

export function useCreateDebtForm() {
  const { defaultCurrency, reminderDaysBefore } = usePreferencesStore();
  const { premium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });

  // Datos del acreedor
  const [creditorName, setCreditorName] = useState('');
  const [creditorPhone, setCreditorPhone] = useState('');
  const [description, setDescription] = useState('');
  const [transferProofUri, setTransferProofUri] = useState<string | null>(null);

  // Datos de la deuda
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termValue, setTermValue] = useState('');
  const [termType, setTermType] = useState<TermType>('months');
  const [interestType, setInterestType] = useState<InterestType>('simple');
  const [currency, setCurrency] = useState<CurrencyType>(defaultCurrency);
  const [deliveryDate, setDeliveryDate] = useState('');

  // Calcula automáticamente el primer pago como delivery_date + 30 días
  const firstPaymentDate = (() => {
    if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return '';
    const d = new Date(deliveryDate + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + 31);
    return d.toISOString().split('T')[0];
  })();

  // Configuración de penalización por mora
  const [latePenaltyType, setLatePenaltyType] = useState<LatePenaltyType>('none');
  const [gracePeriodDays, setGracePeriodDays] = useState('7');
  const [latePenaltyRate, setLatePenaltyRate] = useState('5');

  // Cálculos
  const calculatedPayment = () => {
    if (!principal || !interestRate || !termValue) return null;

    return calculateLoanPayment({
      principalAmount: parseFloat(principal),
      annualInterestRate: parseFloat(interestRate),
      termValue: parseInt(termValue),
      termType,
      interestType,
    });
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
    if (!creditorName.trim()) {
      newErrors.creditorName = 'El nombre es obligatorio';
    } else if (creditorName.trim().length < 2) {
      newErrors.creditorName = 'Ingresá al menos 2 caracteres';
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
    const t = parseInt(termValue);
    if (!termValue.trim()) {
      newErrors.termValue = 'El plazo es obligatorio';
    } else if (isNaN(t) || t <= 0) {
      newErrors.termValue = 'Ingresá un plazo mayor a 0';
    }
    if (!deliveryDate.trim()) {
      newErrors.deliveryDate = 'La fecha es obligatoria';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      newErrors.deliveryDate = 'Formato incorrecto, usá AAAA-MM-DD';
    } else if (isNaN(new Date(deliveryDate + 'T12:00:00').getTime())) {
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
    if (!payment) return;

    // Verificar límite de plan gratuito
    if (!premium) {
      const activeDebts = await getActivePersonalDebts();
      if (activeDebts.length >= FREE_LIMITS.personalDebts) {
        router.push('/(main)/settings/premium');
        return;
      }
    }

    setIsLoading(true);

    try {
      let transferProofUrl: string | null = null;
      if (transferProofUri) {
        try {
          transferProofUrl = await uploadTransferProof(transferProofUri);
        } catch {
          // No bloquear la creación si falla la subida
        }
      }

      const newDebt = await createPersonalDebt({
        creditor_name: creditorName.trim(),
        creditor_phone: creditorPhone.trim() || undefined,
        description: description.trim() || undefined,
        principal_amount: parseFloat(principal),
        interest_rate: parseFloat(interestRate),
        interest_type: interestType,
        term_value: parseInt(termValue),
        term_type: termType,
        currency,
        delivery_date: deliveryDate,
        first_payment_date: firstPaymentDate,
        late_penalty_type: latePenaltyType,
        late_penalty_rate: latePenaltyType !== 'none' ? parseFloat(latePenaltyRate) : 0,
        grace_period_days: latePenaltyType !== 'none' ? parseInt(gracePeriodDays) : 0,
        transfer_proof_url: transferProofUrl,
      });

      // Programar recordatorios locales
      const payments = await getDebtPayments(newDebt.id);
      scheduleDebtPaymentReminders(
        newDebt.id,
        creditorName.trim(),
        payments.map(p => ({ id: p.id, dueDate: p.due_date, amount: p.total_amount, paymentNumber: p.payment_number })),
        reminderDaysBefore
      );

      const currencySymbol = currency === 'ARS' ? '$' : 'US$';
      showSuccess('Deuda creada', `Deuda de ${currencySymbol}${principal} con ${creditorName}`);

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear la deuda';
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
    creditorName,
    setCreditorName,
    creditorPhone,
    setCreditorPhone,
    description,
    setDescription,
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
    deliveryDate,
    setDeliveryDate,
    firstPaymentDate,
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
  };
}
