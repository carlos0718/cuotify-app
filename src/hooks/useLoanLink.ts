import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

export type LoanLinkSearchType = 'dni' | 'email';

/**
 * NOTA: la búsqueda todavía no está conectada a Supabase -- simula un
 * resultado fijo con un setTimeout. Se extrae y testea igual porque tiene
 * lógica real (validación, estado de carga, flujo del Alert), pero no
 * confundir esto con una búsqueda real de préstamos vinculables.
 */
export function useLoanLink() {
  const [searchType, setSearchType] = useState<LoanLinkSearchType>('dni');
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

  return {
    searchType,
    setSearchType,
    searchValue,
    setSearchValue,
    isSearching,
    handleSearch,
  };
}
