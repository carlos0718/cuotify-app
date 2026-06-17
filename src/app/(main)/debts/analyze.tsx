import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { analyzeCreditCardReceipt, CreditCardItem } from '../../../services/gemini/creditCardAnalyzer';
import { createPersonalDebt } from '../../../services/supabase';
import { getLoanColorByIndex } from '../../../utils/loanColors';
import { useToast } from '../../../components';
import { usePreferencesStore } from '../../../store';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

type Phase = 'select' | 'analyzing' | 'review';

interface EditableItem extends CreditCardItem {
  selected: boolean;
  editedCreditor: string;
  editedDescription: string;
  editedInstallments: string; // vacío ("") para suscripciones
}

function FilePreview({ uri, name, isImage }: { uri: string; name?: string; isImage: boolean }) {
  if (isImage) {
    return <Image source={{ uri }} style={styles.imagePreview} resizeMode="cover" />;
  }
  return (
    <View style={styles.docPreview}>
      <Text style={styles.docIcon}>📄</Text>
      <Text style={styles.docName} numberOfLines={2}>{name ?? 'Documento seleccionado'}</Text>
    </View>
  );
}

function ItemCard({
  item,
  index,
  onToggle,
  onEdit,
}: {
  item: EditableItem;
  index: number;
  onToggle: (index: number) => void;
  onEdit: (index: number, field: 'editedCreditor' | 'editedDescription' | 'editedInstallments', value: string) => void;
}) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'ARS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <View style={[styles.card, !item.selected && styles.cardDisabled]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={[styles.checkbox, item.selected && styles.checkboxSelected]}
          onPress={() => onToggle(index)}
        >
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <View style={styles.cardHeaderInfo}>
          <TextInput
            style={[styles.cardTitle, !item.selected && styles.textDisabled]}
            value={item.editedCreditor}
            onChangeText={(v) => onEdit(index, 'editedCreditor', v)}
            placeholder="Nombre del acreedor"
            placeholderTextColor={colors.text.disabled}
            editable={item.selected}
          />
        </View>
        <Text style={styles.cardAmount}>
          {formatCurrency(item.installment_amount, item.currency)}/mes
        </Text>
      </View>

      <TextInput
        style={[styles.cardDescription, !item.selected && styles.textDisabled]}
        value={item.editedDescription}
        onChangeText={(v) => onEdit(index, 'editedDescription', v)}
        placeholder="Descripción del producto"
        placeholderTextColor={colors.text.disabled}
        multiline
        editable={item.selected}
      />

      <View style={styles.cardFooter}>
        {item.type === 'subscription' ? (
          <View style={styles.subscriptionBadge}>
            <Text style={styles.subscriptionBadgeText}>🔄 Suscripción</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.cardFooterLabel, !item.selected && styles.textDisabled]}>
              Cuotas restantes:
            </Text>
            <TextInput
              style={[styles.cardInstallments, !item.selected && styles.textDisabled]}
              value={item.editedInstallments}
              onChangeText={(v) => onEdit(index, 'editedInstallments', v)}
              keyboardType="numeric"
              editable={item.selected}
            />
            {item.total_installments > 0 && (
              <Text style={[styles.cardFooterMuted, !item.selected && styles.textDisabled]}>
                de {item.total_installments}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

export default function AnalyzeCreditCardScreen() {
  const [phase, setPhase] = useState<Phase>('select');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
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
      const editableItems: EditableItem[] = result.items.map((item) => ({
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

  // ─── Phase: analyzing ───────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Analizando...</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.analyzingText}>
            La IA está leyendo tu resumen de tarjeta
          </Text>
          <Text style={styles.analyzingSubtext}>Esto puede tardar unos segundos</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Phase: review ───────────────────────────────────────────────────────────
  if (phase === 'review') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => { setPhase('select'); setItems([]); setBankName(''); setCardBrand(''); }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Resultados</Text>
        </View>

        {(bankName || cardBrand) && (
          <View style={styles.cardLabelBanner}>
            <Text style={styles.cardLabelBannerText}>
              🏦 {[bankName, cardBrand].filter(Boolean).join(' · ')}
            </Text>
          </View>
        )}
        <Text style={styles.reviewSubtitle}>
          Se encontraron {items.length} pago{items.length !== 1 ? 's' : ''}.
          Revisá y editá antes de guardar.
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <ItemCard
              key={index}
              item={item}
              index={index}
              onToggle={handleToggle}
              onEdit={handleEdit}
            />
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createButton, (selectedCount === 0 || isCreating) && styles.buttonDisabled]}
            onPress={handleCreateDebts}
            disabled={selectedCount === 0 || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <Text style={styles.createButtonText}>
                Crear {selectedCount} deuda{selectedCount !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Phase: select ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(main)/debts')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Analizar tarjeta</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Adjuntá tu resumen de tarjeta de crédito y la IA identificará automáticamente los
          productos que estás pagando en cuotas.
        </Text>

        <Text style={styles.formatsLabel}>Formatos soportados</Text>
        <View style={styles.formatsRow}>
          {['📷 Foto', '🖼️ Imagen', '📄 PDF', '📊 CSV', '📑 XLSX'].map((f) => (
            <View key={f} style={styles.formatChip}>
              <Text style={styles.formatChipText}>{f}</Text>
            </View>
          ))}
        </View>

        {fileUri ? (
          <View style={styles.previewContainer}>
            <FilePreview uri={fileUri} name={fileName ?? undefined} isImage={isImage} />
            <TouchableOpacity style={styles.changeFileButton} onPress={handleShowOptions}>
              <Text style={styles.changeFileText}>Cambiar archivo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={handleShowOptions}>
            <Text style={styles.uploadIcon}>📎</Text>
            <Text style={styles.uploadText}>Adjuntar resumen</Text>
            <Text style={styles.uploadSubtext}>Tocá para seleccionar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {fileUri && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.createButton} onPress={handleAnalyze}>
            <Text style={styles.createButtonText}>✨ Analizar resumen</Text>
          </TouchableOpacity>
        </View>
      )}
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    fontSize: fontSize.base,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  description: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  formatsLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  formatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  formatChip: {
    backgroundColor: colors.primary.main + '15',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  formatChipText: {
    fontSize: fontSize.sm,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  uploadIcon: {
    fontSize: 40,
  },
  uploadText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
  },
  uploadSubtext: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  previewContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  imagePreview: {
    width: '100%',
    height: 240,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
  },
  docPreview: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  docIcon: {
    fontSize: 48,
  },
  docName: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  changeFileButton: {
    paddingVertical: spacing.sm,
  },
  changeFileText: {
    fontSize: fontSize.base,
    color: colors.primary.main,
    fontWeight: fontWeight.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  createButton: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
  // analyzing phase
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  analyzingText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  analyzingSubtext: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // review phase
  reviewSubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  checkmark: {
    color: colors.text.inverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 2,
  },
  cardAmount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary.main,
    flexShrink: 0,
  },
  cardDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: 32,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardFooterLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  cardInstallments: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary.main,
    minWidth: 36,
    textAlign: 'center',
  },
  cardFooterMuted: {
    fontSize: fontSize.sm,
    color: colors.text.disabled,
  },
  textDisabled: {
    color: colors.text.disabled,
  },
  cardLabelBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  cardLabelBannerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: colors.info,
  },
  subscriptionBadge: {
    backgroundColor: colors.secondary.main + '20',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.secondary.main + '40',
  },
  subscriptionBadgeText: {
    fontSize: fontSize.sm,
    color: colors.secondary.main,
    fontWeight: fontWeight.medium,
  },
});
