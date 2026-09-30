import { useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore, useSubscriptionStore } from '../store';
import { useToast } from '../components';

export function useDeleteAccountForm() {
  const { profile, signIn, deleteAccount } = useAuthStore();
  const { premium } = useSubscriptionStore();
  const { showError, showSuccess } = useToast();

  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const isBusy = isVerifying || isDeleting;

  const handleRequestDelete = async () => {
    if (!password.trim()) {
      showError('Falta la contraseña', 'Ingresá tu contraseña para continuar');
      return;
    }
    if (!profile?.email) {
      showError('Error', 'No se pudo verificar tu sesión');
      return;
    }

    setIsVerifying(true);
    try {
      await signIn({ email: profile.email, password });
      setShowConfirmModal(true);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      const message = rawMessage.includes('Invalid login credentials')
        ? 'La contraseña no es correcta'
        : rawMessage || 'No se pudo verificar la contraseña';
      showError('No se pudo verificar', message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmDelete = async () => {
    setShowConfirmModal(false);
    setIsDeleting(true);
    try {
      await deleteAccount();
      showSuccess('Cuenta eliminada', 'Tu cuenta y todos tus datos fueron borrados');
      router.replace('/(auth)/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la cuenta';
      showError('Error', message);
      setIsDeleting(false);
    }
  };

  return {
    premium,
    password,
    setPassword,
    isVerifying,
    isDeleting,
    isBusy,
    showConfirmModal,
    setShowConfirmModal,
    handleRequestDelete,
    handleConfirmDelete,
  };
}
