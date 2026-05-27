import { supabase } from './client';
import { useAuthStore } from '../../store';

export async function uploadTransferProof(uri: string): Promise<string> {
  const { user } = useAuthStore.getState();
  if (!user) throw new Error('No hay sesión activa');

  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const filePath = `${user.id}/${Date.now()}.${ext}`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('transfer-proofs')
    .upload(filePath, blob, { contentType, upsert: true });

  if (error) throw new Error(`Error al subir imagen: ${error.message}`);

  const { data } = supabase.storage.from('transfer-proofs').getPublicUrl(filePath);
  return data.publicUrl;
}
