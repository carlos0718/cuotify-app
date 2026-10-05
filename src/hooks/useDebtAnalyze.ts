import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { analyzeCreditCardReceipt, CreditCardItem } from '../services/gemini/creditCardAnalyzer';
import { createPersonalDebt } from '../services/supabase';
import { getLoanColorByIndex } from '../utils/loanColors';
import { useToast } from '../components';
import { usePreferencesStore } from '../store';

export type DebtAnalyzePhase = 'select' | 'analyzing' | 'review';

export interface EditableDebtItem extends CreditCardItem {
  selected: boolean;
  editedCreditor: string;
  editedDescription: string;
  editedInstallments: string; // vacío ("") para suscripciones
}

export function useDebtAnalyze() {
  const [phase, setPhase] = useState<DebtAnalyzePhase>('select');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [items, setItems] = useState<EditableDebtItem[]>([]);
  const [bankName, setBankName] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { showSuccess, showError } = useToast();
  const { defaultCurrency } = usePreferencesStore();

  const handleOpenCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError('Permiso requerido', 'Necesitamos acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(null);
      setIsImage(true);
    }
  };

  const handleOpenGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Permiso requerido', 'Necesitamos acceso a la galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setFileUri(result.assets[0].uri);
      setFileName(null);
      setIsImage(true);
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
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].name);
      setIsImage(false);
    }
  };

  const handleShowOptions = () => {
    Alert.alert(
      'Adjuntar resumen',
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
      const result = await analyzeCreditCardReceipt(fileUri);
      if (result.items.length === 0) {
        showError('Sin resultados', 'No se encontraron pagos en cuotas en el archivo');
        setPhase('select');
        return;
      }
      setBankName(result.bankName);
      setCardBrand(result.cardBrand);
      const editableItems: EditableDebtItem[] = result.items.map((item) => ({
        ...item,
        currency: (item.currency as 'ARS' | 'USD') ?? defaultCurrency,
        type: item.type ?? 'installment',
        selected: true,
        editedCreditor: item.creditor_name,
        editedDescription: item.description,
        editedInstallments: item.type === 'subscription' ? '' : String(item.installments_remaining),
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
    setBankName('');
    setCardBrand('');
  };

  const handleToggle = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleEdit = (
    index: number,
    field: 'editedCreditor' | 'editedDescription' | 'editedInstallments',
    value: string
  ) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleCreateDebts = async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) return;

    setIsCreating(true);
    let successCount = 0;
    let colorIndex = 0;
    const today = new Date().toISOString().split('T')[0];

    const firstPaymentDate = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + 31);
      return d.toISOString().split('T')[0];
    })();

    for (const item of selected) {
      const isSubscription = item.type === 'subscription';
      const remaining = isSubscription ? 12 : parseInt(item.editedInstallments, 10);
      if (!remaining || remaining <= 0) continue;
      const principal = item.installment_amount * remaining;
      const cardLabel = [bankName, cardBrand].filter(Boolean).join(' ');
      const baseDesc = item.editedDescription || (isSubscription ? 'Suscripción mensual' : '');
      const fullDescription = cardLabel
        ? baseDesc ? `${baseDesc} · ${cardLabel}` : cardLabel
        : baseDesc || undefined;
      try {
        await createPersonalDebt({
          creditor_name: item.editedCreditor || item.creditor_name,
          description: fullDescription,
          color_code: getLoanColorByIndex(colorIndex++),
          principal_amount: principal,
          interest_rate: 0,
          interest_type: 'simple',
          term_value: remaining,
          term_type: 'months',
          currency: item.currency,
          delivery_date: today,
          first_payment_date: firstPaymentDate,
          late_penalty_type: 'none',
          late_penalty_rate: 0,
          grace_period_days: 0,
        });
        successCount++;
      } catch (err) {
        console.error('Error creando deuda:', err);
      }
    }

    setIsCreating(false);

    if (successCount > 0) {
      showSuccess(
        'Deudas creadas',
        `Se crearon ${successCount} deuda${successCount > 1 ? 's' : ''} correctamente`
      );
      setTimeout(() => router.replace('/(main)/debts'), 1200);
    } else {
      showError('Error', 'No se pudo crear ninguna deuda');
    }
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return {
    phase,
    fileUri,
    fileName,
    isImage,
    items,
    bankName,
    cardBrand,
    isCreating,
    selectedCount,
    handleShowOptions,
    handleAnalyze,
    handleBackToSelect,
    handleToggle,
    handleEdit,
    handleCreateDebts,
  };
}
