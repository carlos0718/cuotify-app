import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../../theme';

interface Country {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

// Lista de países con nombres en español y emojis de bandera
// LATAM primero, luego el resto alfabéticamente
const COUNTRIES: Country[] = [
  { code: 'AR', dialCode: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: 'BO', dialCode: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'BR', dialCode: '+55',  flag: '🇧🇷', name: 'Brasil' },
  { code: 'CL', dialCode: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: 'CO', dialCode: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: 'CR', dialCode: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: 'CU', dialCode: '+53',  flag: '🇨🇺', name: 'Cuba' },
  { code: 'DO', dialCode: '+1',   flag: '🇩🇴', name: 'República Dominicana' },
  { code: 'EC', dialCode: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'SV', dialCode: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: 'GT', dialCode: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: 'HN', dialCode: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: 'MX', dialCode: '+52',  flag: '🇲🇽', name: 'México' },
  { code: 'NI', dialCode: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: 'PA', dialCode: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: 'PY', dialCode: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'PE', dialCode: '+51',  flag: '🇵🇪', name: 'Perú' },
  { code: 'PR', dialCode: '+1',   flag: '🇵🇷', name: 'Puerto Rico' },
  { code: 'UY', dialCode: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: 'VE', dialCode: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  // Resto del mundo
  { code: 'DE', dialCode: '+49',  flag: '🇩🇪', name: 'Alemania' },
  { code: 'SA', dialCode: '+966', flag: '🇸🇦', name: 'Arabia Saudita' },
  { code: 'AU', dialCode: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: 'AT', dialCode: '+43',  flag: '🇦🇹', name: 'Austria' },
  { code: 'BE', dialCode: '+32',  flag: '🇧🇪', name: 'Bélgica' },
  { code: 'CA', dialCode: '+1',   flag: '🇨🇦', name: 'Canadá' },
  { code: 'CN', dialCode: '+86',  flag: '🇨🇳', name: 'China' },
  { code: 'KR', dialCode: '+82',  flag: '🇰🇷', name: 'Corea del Sur' },
  { code: 'DK', dialCode: '+45',  flag: '🇩🇰', name: 'Dinamarca' },
  { code: 'EG', dialCode: '+20',  flag: '🇪🇬', name: 'Egipto' },
  { code: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'Emiratos Árabes' },
  { code: 'ES', dialCode: '+34',  flag: '🇪🇸', name: 'España' },
  { code: 'US', dialCode: '+1',   flag: '🇺🇸', name: 'Estados Unidos' },
  { code: 'PH', dialCode: '+63',  flag: '🇵🇭', name: 'Filipinas' },
  { code: 'FI', dialCode: '+358', flag: '🇫🇮', name: 'Finlandia' },
  { code: 'FR', dialCode: '+33',  flag: '🇫🇷', name: 'Francia' },
  { code: 'GR', dialCode: '+30',  flag: '🇬🇷', name: 'Grecia' },
  { code: 'NL', dialCode: '+31',  flag: '🇳🇱', name: 'Holanda' },
  { code: 'HU', dialCode: '+36',  flag: '🇭🇺', name: 'Hungría' },
  { code: 'IN', dialCode: '+91',  flag: '🇮🇳', name: 'India' },
  { code: 'ID', dialCode: '+62',  flag: '🇮🇩', name: 'Indonesia' },
  { code: 'IE', dialCode: '+353', flag: '🇮🇪', name: 'Irlanda' },
  { code: 'IL', dialCode: '+972', flag: '🇮🇱', name: 'Israel' },
  { code: 'IT', dialCode: '+39',  flag: '🇮🇹', name: 'Italia' },
  { code: 'JP', dialCode: '+81',  flag: '🇯🇵', name: 'Japón' },
  { code: 'MY', dialCode: '+60',  flag: '🇲🇾', name: 'Malasia' },
  { code: 'MA', dialCode: '+212', flag: '🇲🇦', name: 'Marruecos' },
  { code: 'NO', dialCode: '+47',  flag: '🇳🇴', name: 'Noruega' },
  { code: 'NZ', dialCode: '+64',  flag: '🇳🇿', name: 'Nueva Zelanda' },
  { code: 'PK', dialCode: '+92',  flag: '🇵🇰', name: 'Pakistán' },
  { code: 'PL', dialCode: '+48',  flag: '🇵🇱', name: 'Polonia' },
  { code: 'PT', dialCode: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'GB', dialCode: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
  { code: 'CZ', dialCode: '+420', flag: '🇨🇿', name: 'República Checa' },
  { code: 'RO', dialCode: '+40',  flag: '🇷🇴', name: 'Rumania' },
  { code: 'RU', dialCode: '+7',   flag: '🇷🇺', name: 'Rusia' },
  { code: 'SE', dialCode: '+46',  flag: '🇸🇪', name: 'Suecia' },
  { code: 'CH', dialCode: '+41',  flag: '🇨🇭', name: 'Suiza' },
  { code: 'TH', dialCode: '+66',  flag: '🇹🇭', name: 'Tailandia' },
  { code: 'TW', dialCode: '+886', flag: '🇹🇼', name: 'Taiwán' },
  { code: 'TR', dialCode: '+90',  flag: '🇹🇷', name: 'Turquía' },
  { code: 'UA', dialCode: '+380', flag: '🇺🇦', name: 'Ucrania' },
  { code: 'ZA', dialCode: '+27',  flag: '🇿🇦', name: 'Sudáfrica' },
  { code: 'NG', dialCode: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'KE', dialCode: '+254', flag: '🇰🇪', name: 'Kenia' },
];

interface PhoneInputProps {
  value: string;
  onChange: (e164: string) => void;
  defaultCountry?: string;
  label?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'AR',
  label = 'Teléfono',
}: PhoneInputProps) {
  const [selectedCode, setSelectedCode] = useState(defaultCountry);
  const [localNumber, setLocalNumber] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');

  const currentCountry = COUNTRIES.find((c) => c.code === selectedCode) ?? COUNTRIES[0];

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q)
    );
  }, [search]);

  const buildE164 = (dial: string, local: string): string => {
    const digits = local.replace(/\D/g, '');
    if (!digits) return '';
    return `${dial}${digits}`;
  };

  const handleChangeNumber = (text: string) => {
    setLocalNumber(text);
    onChange(buildE164(currentCountry.dialCode, text));
  };

  const handleSelectCountry = (country: Country) => {
    setSelectedCode(country.code);
    setPickerVisible(false);
    setSearch('');
    onChange(buildE164(country.dialCode, localNumber));
  };

  const isValid = value.length > 7;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.inputRow}>
        {/* Selector de país */}
        <TouchableOpacity
          style={styles.countryButton}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{currentCountry.flag}</Text>
          <Text style={styles.dialCode}>{currentCountry.dialCode}</Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        {/* Input del número local */}
        <TextInput
          style={styles.numberInput}
          placeholder="9 11 1234 5678"
          placeholderTextColor={colors.text.disabled}
          value={localNumber}
          onChangeText={handleChangeNumber}
          keyboardType="phone-pad"
        />
      </View>

      {localNumber.length > 0 && isValid && (
        <Text style={styles.e164}>✓ {value}</Text>
      )}

      {/* Modal del selector de país */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={() => { setPickerVisible(false); setSearch(''); }}
      >
        <SafeAreaView style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Seleccionar país</Text>
            <TouchableOpacity onPress={() => { setPickerVisible(false); setSearch(''); }}>
              <Text style={styles.pickerClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Búsqueda */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar país..."
              placeholderTextColor={colors.text.disabled}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {/* Lista de países */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryItem,
                  item.code === selectedCode && styles.countryItemSelected,
                ]}
                onPress={() => handleSelectCountry(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.itemFlag}>{item.flag}</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemDial}>{item.dialCode}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 4,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  chevron: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  numberInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  e164: {
    fontSize: fontSize.xs,
    color: colors.success,
    marginTop: 4,
    fontWeight: fontWeight.medium,
  },
  // Modal del picker
  pickerContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  pickerClose: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  countryItemSelected: {
    backgroundColor: colors.primary.main + '15',
  },
  itemFlag: {
    fontSize: 24,
    width: 36,
  },
  itemName: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  itemDial: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
});
