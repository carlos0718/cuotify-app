import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../store';
import { supabase } from '../services/supabase';

export function useProfileForm() {
  const { profile, refreshProfile } = useAuthStore();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [dni, setDni] = useState(profile?.dni || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    if (!profile) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          dni: dni.trim() || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();

      Alert.alert('Guardado', 'Tu perfil ha sido actualizado');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    profile,
    fullName,
    setFullName,
    phone,
    setPhone,
    dni,
    setDni,
    isLoading,
    handleSave,
  };
}
