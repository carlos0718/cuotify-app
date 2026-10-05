import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../services/supabase/client';
import { updatePassword } from '../services/supabase/auth';
import { useToast } from '../components';

export function useResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidSession, setIsValidSession] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    const validateSession = async () => {
      try {
        // La sesión ya fue creada: al verificar el código de recuperación
        // (verifyOtp) o porque el usuario está logueado y viene desde Ajustes.
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setIsValidSession(true);
        } else {
          showError('Sesión inválida', 'No se pudo validar tu sesión. Solicita un nuevo código.');
          setTimeout(() => {
            router.replace('/(auth)/forgot-password');
          }, 2000);
        }
      } catch (error) {
        showError('Error', 'No se pudo validar la sesión');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showError('Error', 'Por favor ingresa una nueva contraseña');
      return;
    }

    if (newPassword.length < 6) {
      showError('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(newPassword);
      showSuccess('Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente');

      // Cerrar sesión para que el usuario inicie con su nueva contraseña
      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo actualizar la contraseña'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    isValidating,
    isValidSession,
    handleResetPassword,
  };
}
