import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../../../theme';

export default function LinkLoanScreen() {
  const [searchType, setSearchType] = useState<'dni' | 'email'>('dni');
  const [searchValue, setSearchValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if (!searchValue.trim()) {
      Alert.alert('Error', `Ingresa el ${searchType === 'dni' ? 'DNI' : 'email'} del prestamista`);
      return;
    }

    setIsSearching(true);

    // Simular búsqueda
    setTimeout(() => {
      setIsSearching(false);
      Alert.alert(
        'Préstamo encontrado',
        'Se encontró un préstamo de $5,000 con Juan Pérez. ¿Deseas vincularlo a tu cuenta?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vincular',
            onPress: () => {
              Alert.alert('Vinculado', 'El préstamo ha sido vinculado a tu cuenta');
              router.back();
            },
          },
        ]
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Vincular Préstamo</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>¿Cómo funciona?</Text>
          <Text style={styles.infoText}>
            Busca al prestamista por su DNI o email para ver los préstamos que
            tiene registrados a tu nombre. Una vez vinculado, podrás ver el
            detalle de tus deudas.
          </Text>
        </View>

        <View style={styles.searchTypeContainer}>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'dni' && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType('dni')}
          >
            <Text
              style={[
                styles.searchTypeText,
                searchType === 'dni' && styles.searchTypeTextActive,
              ]}
            >
              Buscar por DNI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'email' && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType('email')}
          >
            <Text
              style={[
                styles.searchTypeText,
                searchType === 'email' && styles.searchTypeTextActive,
              ]}
            >
              Buscar por Email
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {searchType === 'dni' ? 'DNI del prestamista' : 'Email del prestamista'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={searchType === 'dni' ? '12345678' : 'prestamista@email.com'}
            placeholderTextColor={colors.text.disabled}
            value={searchValue}
            onChangeText={setSearchValue}
            keyboardType={searchType === 'dni' ? 'numeric' : 'email-address'}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Text style={styles.searchButtonText}>
            {isSearching ? 'Buscando...' : 'Buscar Préstamo'}
          </Text>
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
    padding: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.primary.main + '10',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.primary.main,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  searchTypeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  searchTypeButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  searchTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  searchTypeTextActive: {
    color: colors.text.inverse,
  },
  inputContainer: {
    marginBottom: spacing.lg,
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
  searchButton: {
    backgroundColor: colors.primary.main,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.text.inverse,
  },
});
