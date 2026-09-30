import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { analyzeLoanDocument, LoanItem } from '../services/gemini/loansAnalyzer';
import { getOrCreateBorrower, createLoan } from '../services/supabase';
import { calculateLoanPayment, calculateEndDate } from '../services/calculations';
import { useToast } from '../components';
import { useAuthStore, usePreferencesStore } from '../store';
import { getLoanColorByIndex } from '../utils/loanColors';

export type LoanAnalyzePhase = 'select' | 'analyzing' | 'review';

export interface EditableLoanItem extends LoanItem {
  selected: boolean;
  editedName: string;
  editedDni: string;
  editedPhone: string;
  editedPrincipal: string;
  editedInterestRate: string;
  editedTermValue: string;
  editedNotes: string;
}

export function useLoanAnalyze() {
  const [phase, setPhase] = useState<LoanAnalyzePhase>('select');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [items, setItems] = useState<EditableLoanItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { showSuccess, showError } = useToast();
  const { session } = useAuthStore();
  const { defaultCurrency } = usePreferencesStore();
  const lenderId = session?.user?.id ?? '';

  const handleOpenCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showError('Permiso requerido', 'Necesitamos acceso a la cámara'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri); setFileName(null); setIsImage(true);
    }
  };

  const handleOpenGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showError('Permiso requerido', 'Necesitamos acceso a la galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri); setFileName(null); setIsImage(true);
    }
  };

  const handleOpenDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri); setFileName(result.assets[0].name); setIsImage(false);
    }
  };

  const handleShowOptions = () => {
    Alert.alert(
      'Adjuntar documento',
      'Seleccioná el origen del archivo',
      [
        { text: 'Cámara', onPress: handleOpenCamera },
        { text: 'Galería de fotos', onPress: handleOpenGallery },
        { text: 'PDF / CSV / XLSX', onPress: handleOpenDocument },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleAnalyze = async () => {
    if (!fileUri) return;
    setPhase('analyzing');
    try {
      const extracted = await analyzeLoanDocument(fileUri);
      if (extracted.length === 0) {
        showError('Sin resultados', 'No se encontraron préstamos en el documento');
        setPhase('select');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const editableItems: EditableLoanItem[] = extracted.map((item) => ({
        ...item,
        currency: item.currency ?? defaultCurrency,
        delivery_date: item.delivery_date || today,
        selected: true,
        editedName: item.borrower_name,
        editedDni: item.borrower_dni ?? '',
        editedPhone: item.borrower_phone ?? '',
        editedPrincipal: String(item.principal_amount),
        editedInterestRate: String(item.interest_rate),
        editedTermValue: String(item.term_value),
        editedNotes: item.notes ?? '',
      }));
      setItems(editableItems);
      setPhase('review');
    } catch (err) {
      showError('Error al analizar', err instanceof Error ? err.message : 'Intentá de nuevo');
      setPhase('select');
    }
  };

  const handleBackToSelect = () => {
    setPhase('select');
    setItems([]);
  };

  const handleToggle = (index: number) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const handleEdit = (index: number, field: keyof EditableLoanItem, value: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleCreateLoans = async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0 || !lenderId) return;

    setIsCreating(true);
    let successCount = 0;
    let colorIndex = 0;

    for (const item of selected) {
      const principal = parseFloat(item.editedPrincipal);
      const interestRate = parseFloat(item.editedInterestRate) || 0;
      const termValue = parseInt(item.editedTermValue, 10) || 1;
      if (!principal || principal <= 0) continue;

      try {
        // 1. Obtener o crear el prestatario
        const { borrower } = await getOrCreateBorrower({
          lender_id: lenderId,
          full_name: item.editedName || item.borrower_name,
          dni: item.editedDni || null,
          phone: item.editedPhone || null,
          notes: item.editedNotes || null,
        });

        // 2. Calcular montos del préstamo
        const payment = calculateLoanPayment({
          principalAmount: principal,
          annualInterestRate: interestRate,
          termValue,
          termType: item.term_type,
          interestType: item.interest_type,
        });

        // 3. Calcular fechas
        const deliveryDate = item.delivery_date;
        const firstPaymentDate = new Date(deliveryDate + 'T12:00:00');
        if (item.term_type === 'months') {
          firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
        } else {
          firstPaymentDate.setDate(firstPaymentDate.getDate() + 7);
        }
        const endDate = calculateEndDate(firstPaymentDate, termValue, item.term_type);

        // 4. Crear el préstamo
        await createLoan({
          lender_id: lenderId,
          borrower_id: borrower.id,
          principal_amount: principal,
          interest_rate: interestRate,
          term_value: termValue,
          term_type: item.term_type,
          interest_type: item.interest_type,
          currency: item.currency,
          payment_amount: payment.paymentAmount,
          total_interest: payment.totalInterest,
          total_amount: payment.totalAmount,
          delivery_date: deliveryDate,
          first_payment_date: firstPaymentDate.toISOString().split('T')[0],
          end_date: endDate ? endDate.toISOString().split('T')[0] : null,
          late_penalty_type: 'none',
          late_penalty_rate: 0,
          grace_period_days: 0,
          notes: item.editedNotes || null,
          color_code: getLoanColorByIndex(colorIndex++),
        });

        successCount++;
      } catch (err) {
        console.error('Error creando préstamo:', err);
      }
    }

    setIsCreating(false);

    if (successCount > 0) {
      showSuccess(
        'Préstamos creados',
        `Se crearon ${successCount} préstamo${successCount > 1 ? 's' : ''} correctamente`
      );
      setTimeout(() => router.replace('/(main)/loans'), 1200);
    } else {
      showError('Error', 'No se pudo crear ningún préstamo');
    }
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return {
    phase,
    fileUri,
    fileName,
    isImage,
    items,
    isCreating,
    selectedCount,
    handleShowOptions,
    handleAnalyze,
    handleBackToSelect,
    handleToggle,
    handleEdit,
    handleCreateLoans,
  };
}
