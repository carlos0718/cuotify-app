import { useState } from 'react';
import { router } from 'expo-router';
import { resetPassword, verifyRecoveryOtp } from '../services/supabase/auth';
import { useToast } from '../components';
import { validateEmail } from '../utils';

export function useForgotPasswordForm() {
  const [step, setStep] = useState(1); // 1: email, 2: código
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError, showWarning } = useToast();

  const handleSendCode = async () => {
    if (!email.trim()) {
      showError('Error', 'Por favor ingresa tu correo electrónico');
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

    setIsLoading(true);

    try {
      await resetPassword(email.trim());
      showSuccess('Código enviado', 'Revisa tu correo e ingresa el código de 8 dígitos');
      setStep(2);
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo enviar el código'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length !== 8) {
      showError('Error', 'Ingresa el código de 8 dígitos');
      return;
    }

    setIsLoading(true);

    try {
      await verifyRecoveryOtp(email.trim(), code.trim());
      // verifyOtp deja una sesión activa; la pantalla de reset-password la usa
      router.replace('/(auth)/reset-password');
    } catch (error) {
      showError(
        'Código inválido',
        error instanceof Error ? error.message : 'El código es incorrecto o expiró'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      showSuccess('Código reenviado', 'Te enviamos un nuevo código a tu correo');
    } catch (error) {
      showError(
        'Error',
        error instanceof Error ? error.message : 'No se pudo reenviar el código'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setCode('');
    setStep(1);
  };

  return {
    step,
    email,
    setEmail,
    code,
    setCode,
    isLoading,
    handleSendCode,
    handleVerifyCode,
    handleResendCode,
    handleChangeEmail,
  };
}
