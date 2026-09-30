import { useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../store';
import { useToast } from '../components';
import { validateEmail } from '../utils';

export function useLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { signIn, isLoading, clearError } = useAuthStore();
  const { showError, showWarning } = useToast();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError('Error', 'Por favor completa todos los campos');
      return;
    }

    // Validar email con detección de typos
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError('Correo inválido', emailValidation.error || 'El correo no es válido');
      return;
    }
    if (emailValidation.warning) {
      showWarning('Revisá tu correo', emailValidation.warning);
    }

    try {
      await signIn({ email: email.trim(), password });
      router.replace('/(main)/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo iniciar sesión';
      showError('Error', errorMessage);
      clearError();
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    isLoading,
    handleLogin,
  };
}
