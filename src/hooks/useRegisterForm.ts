import { useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '../store';
import { useToast } from '../components';
import { validateEmail, validateDNI, validatePhone } from '../utils';

export function useRegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { signUp, isLoading, clearError } = useAuthStore();
  const { showSuccess, showError, showWarning } = useToast();

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      showError('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      showError('Correo inválido', emailValidation.error || 'El correo no es válido');
      return;
    }
    if (emailValidation.warning) {
      showWarning('Revisá tu correo', emailValidation.warning);
    }

    const dniValidation = validateDNI(dni);
    if (!dniValidation.isValid) {
      showError('DNI inválido', dniValidation.error || 'El DNI no es válido');
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      showError('Teléfono inválido', phoneValidation.error || 'El teléfono no es válido');
      return;
    }

    if (password !== confirmPassword) {
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        dni: dni.trim() || undefined,
        phone: phone.trim() || undefined,
        role: 'both',
      });

      showSuccess('Registro exitoso', 'Tu cuenta ha sido creada');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo crear la cuenta';
      showError('Error', errorMessage);
      clearError();
    }
  };

  return {
    fullName,
    setFullName,
    email,
    setEmail,
    dni,
    setDni,
    phone,
    setPhone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    handleRegister,
  };
}
