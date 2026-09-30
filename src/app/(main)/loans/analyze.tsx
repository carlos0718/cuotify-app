import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';
import { useLoanAnalyze, EditableLoanItem } from '../../../hooks';

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

function LoanCard({
  item,
  index,
  onToggle,
  onEdit,
}: {
  item: EditableLoanItem;
  index: number;
  onToggle: (i: number) => void;
  onEdit: (i: number, field: keyof EditableLoanItem, value: string) => void;
}) {
  const termLabel = item.term_type === 'months' ? 'meses' : 'semanas';

  return (
    <View style={[styles.card, !item.selected && styles.cardDisabled]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={[styles.checkbox, item.selected && styles.checkboxSelected]}
          onPress={() => onToggle(index)}
        >
          {item.selected && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <View style={styles.cardTitleRow}>
          <TextInput
            style={[styles.cardTitle, !item.selected && styles.textDisabled]}
            value={item.editedName}
            onChangeText={(v) => onEdit(index, 'editedName', v)}
            placeholder="Nombre del prestatario"
            placeholderTextColor={colors.text.disabled}
            editable={item.selected}
          />
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.cardField}>
          <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>Monto</Text>
          <TextInput
            style={[styles.fieldInput, !item.selected && styles.textDisabled]}
            value={item.editedPrincipal}
            onChangeText={(v) => onEdit(index, 'editedPrincipal', v)}
            keyboardType="decimal-pad"
            editable={item.selected}
          />
        </View>
        <View style={styles.cardField}>
          <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>Interés %</Text>
          <TextInput
            style={[styles.fieldInput, !item.selected && styles.textDisabled]}
            value={item.editedInterestRate}
            onChangeText={(v) => onEdit(index, 'editedInterestRate', v)}
            keyboardType="decimal-pad"
            editable={item.selected}
          />
        </View>
        <View style={styles.cardField}>
          <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>{termLabel}</Text>
          <TextInput
            style={[styles.fieldInput, !item.selected && styles.textDisabled]}
            value={item.editedTermValue}
            onChangeText={(v) => onEdit(index, 'editedTermValue', v)}
            keyboardType="numeric"
            editable={item.selected}
          />
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.cardField, { flex: 1 }]}>
          <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>DNI</Text>
          <TextInput
            style={[styles.fieldInput, !item.selected && styles.textDisabled]}
            value={item.editedDni}
            onChangeText={(v) => onEdit(index, 'editedDni', v)}
            keyboardType="numeric"
            placeholder="Opcional"
            placeholderTextColor={colors.text.disabled}
            editable={item.selected}
          />
        </View>
        <View style={[styles.cardField, { flex: 1.5 }]}>
          <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>Teléfono</Text>
          <TextInput
            style={[styles.fieldInput, !item.selected && styles.textDisabled]}
            value={item.editedPhone}
            onChangeText={(v) => onEdit(index, 'editedPhone', v)}
            keyboardType="phone-pad"
            placeholder="Opcional"
            placeholderTextColor={colors.text.disabled}
            editable={item.selected}
          />
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.fieldLabel, !item.selected && styles.textDisabled]}>
          {item.currency} · {item.interest_type === 'french' ? 'Francés' : 'Simple'} · {item.delivery_date}
        </Text>
      </View>

      {item.editedNotes ? (
        <Text style={[styles.cardNotes, !item.selected && styles.textDisabled]} numberOfLines={2}>
          {item.editedNotes}
        </Text>
      ) : null}
    </View>
  );
}

export default function AnalyzeLoansScreen() {
  const {
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
  } = useLoanAnalyze();

  // ── Analyzing ────────────────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Analizando...</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.analyzingText}>La IA está leyendo el documento</Text>
          <Text style={styles.analyzingSubtext}>Esto puede tardar unos segundos</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Review ───────────────────────────────────────────────────────────────────
  if (phase === 'review') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBackToSelect}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Resultados</Text>
        </View>

        <Text style={styles.reviewSubtitle}>
          Se encontraron {items.length} préstamo{items.length !== 1 ? 's' : ''}.
          Revisá y editá antes de guardar.
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <LoanCard
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
            onPress={handleCreateLoans}
            disabled={selectedCount === 0 || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <Text style={styles.createButtonText}>
                Crear {selectedCount} préstamo{selectedCount !== 1 ? 's' : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Select ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(main)/loans')} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Importar préstamos</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Adjuntá una lista de préstamos escrita a mano, planilla Excel, imagen o PDF.
          La IA extrae los datos y los registra automáticamente.
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
            <Text style={styles.uploadText}>Adjuntar documento</Text>
            <Text style={styles.uploadSubtext}>Tocá para seleccionar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {fileUri && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.createButton} onPress={handleAnalyze}>
            <Text style={styles.createButtonText}>✨ Analizar documento</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: { paddingVertical: spacing.xs },
  backButtonText: { fontSize: fontSize.base, color: colors.primary.main, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  description: { fontSize: fontSize.base, color: colors.text.secondary, lineHeight: 22, marginBottom: spacing.lg },
  formatsLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, color: colors.text.secondary, marginBottom: spacing.sm },
  formatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  formatChip: {
    backgroundColor: colors.primary.main + '15',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  formatChipText: { fontSize: fontSize.sm, color: colors.primary.main, fontWeight: fontWeight.medium },
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
  uploadIcon: { fontSize: 40 },
  uploadText: { fontSize: fontSize.lg, fontWeight: fontWeight.semiBold, color: colors.text.primary },
  uploadSubtext: { fontSize: fontSize.sm, color: colors.text.secondary },
  previewContainer: { alignItems: 'center', gap: spacing.md },
  imagePreview: { width: '100%', height: 240, borderRadius: borderRadius.xl, backgroundColor: colors.surface },
  docPreview: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  docIcon: { fontSize: 48 },
  docName: { fontSize: fontSize.base, color: colors.text.primary, textAlign: 'center', fontWeight: fontWeight.medium },
  changeFileButton: { paddingVertical: spacing.sm },
  changeFileText: { fontSize: fontSize.base, color: colors.primary.main, fontWeight: fontWeight.medium },
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
  buttonDisabled: { opacity: 0.5 },
  createButtonText: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.text.inverse },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  analyzingText: { fontSize: fontSize.lg, fontWeight: fontWeight.semiBold, color: colors.text.primary, textAlign: 'center' },
  analyzingSubtext: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: 'center' },
  reviewSubtitle: { fontSize: fontSize.base, color: colors.text.secondary, paddingHorizontal: spacing.lg, marginBottom: spacing.md, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  cardDisabled: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  checkbox: {
    width: 24, height: 24, borderRadius: borderRadius.sm,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  checkmark: { color: colors.text.inverse, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  cardTitleRow: { flex: 1 },
  cardTitle: {
    fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.text.primary,
    borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 2,
  },
  cardRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  cardField: { flex: 1 },
  fieldLabel: { fontSize: fontSize.xs, color: colors.text.secondary, marginBottom: 2 },
  fieldInput: {
    fontSize: fontSize.sm, color: colors.text.primary,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: 4, fontWeight: fontWeight.medium,
  },
  cardFooter: { marginTop: spacing.xs },
  cardNotes: { fontSize: fontSize.xs, color: colors.text.secondary, marginTop: spacing.xs, fontStyle: 'italic' },
  textDisabled: { color: colors.text.disabled },
});
