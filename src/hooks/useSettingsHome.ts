import { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore, usePreferencesStore, useSubscriptionStore } from '../store';
import { useToast } from '../components';
import { updateAllLoanColors } from '../services/supabase';
import { colors } from '../theme';
import { CurrencyType, DollarRateType } from '../types';

// Información de contacto de soporte
export const SUPPORT_EMAIL = 'soporte@cuotify.app';
const SUPPORT_WHATSAPP = '+5491112345678'; // Cambiar por el número real

export function useSettingsHome() {
  const { profile, signOut } = useAuthStore();
  const { defaultCurrency, setDefaultCurrency, dollarRateType, setDollarRateType } =
    usePreferencesStore();
  const { premium } = useSubscriptionStore();
  const { showSuccess, showError } = useToast();

  // Estados de modales
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showDollarRateModal, setShowDollarRateModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [isUpdatingColors, setIsUpdatingColors] = useState(false);

  const handleUpdateLoanColors = async () => {
    setIsUpdatingColors(true);
    try {
      const count = await updateAllLoanColors([...colors.loanColors]);
      showSuccess('Colores actualizados', `Se actualizaron ${count} préstamos con nuevos colores`);
    } catch (error) {
      showError('Error', 'No se pudieron actualizar los colores');
    } finally {
      setIsUpdatingColors(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleContactEmail = () => {
    setShowContactModal(false);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Soporte Cuotify&body=Hola, necesito ayuda con...`);
  };

  const handleContactWhatsApp = () => {
    setShowContactModal(false);
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}?text=Hola, necesito ayuda con la app Cuotify`);
  };

  const handleRateApp = () => {
    setShowRateModal(false);
    setShowThanksModal(true);
    // TODO: Reemplazar con links reales cuando se publique
    // Para Android: Linking.openURL('market://details?id=com.cuotify.app')
    // Para iOS: Linking.openURL('itms-apps://itunes.apple.com/app/idXXXXXXXXX?action=write-review')
  };

  const handleSelectCurrency = (currency: CurrencyType) => {
    setDefaultCurrency(currency);
    setShowCurrencyModal(false);
  };

  const handleSelectDollarRate = (type: DollarRateType) => {
    setDollarRateType(type);
    setShowDollarRateModal(false);
  };

  return {
    profile,
    defaultCurrency,
    dollarRateType,
    premium,
    showCurrencyModal,
    setShowCurrencyModal,
    showDollarRateModal,
    setShowDollarRateModal,
    showLogoutModal,
    setShowLogoutModal,
    showContactModal,
    setShowContactModal,
    showFAQModal,
    setShowFAQModal,
    showTermsModal,
    setShowTermsModal,
    showPrivacyModal,
    setShowPrivacyModal,
    showRateModal,
    setShowRateModal,
    showLanguageModal,
    setShowLanguageModal,
    showThanksModal,
    setShowThanksModal,
    isUpdatingColors,
    handleUpdateLoanColors,
    handleLogout,
    handleContactEmail,
    handleContactWhatsApp,
    handleRateApp,
    handleSelectCurrency,
    handleSelectDollarRate,
  };
}
