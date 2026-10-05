import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../theme';
import { useCustomerCenter } from '../../../hooks';

/**
 * Customer Center — pantalla gestionada por RevenueCat que permite al usuario:
 * - Ver su plan activo
 * - Cancelar suscripción
 * - Solicitar reembolso
 * - Restaurar compras
 * - Contactar soporte
 *
 * Se accede desde Settings → Mi Plan (solo si el usuario es premium)
 */
export default function CustomerCenterScreen() {
  useCustomerCenter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary.main} size="large" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
