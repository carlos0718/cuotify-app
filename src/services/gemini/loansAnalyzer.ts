import { supabase } from '../supabase/client';
import { getMimeType, base64ByteSize, MAX_FILE_BYTES } from './creditCardAnalyzer';

export interface LoanItem {
  borrower_name: string;
  borrower_dni: string | null;
  borrower_phone: string | null;
  principal_amount: number;
  interest_rate: number;
  term_value: number;
  term_type: 'months' | 'weeks';
  interest_type: 'simple' | 'french';
  currency: 'ARS' | 'USD';
  delivery_date: string;
  notes: string | null;
}

async function fileUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function analyzeLoanDocument(fileUri: string): Promise<LoanItem[]> {
  const mimeType = getMimeType(fileUri);
  const fileBase64 = await fileUriToBase64(fileUri);

  if (base64ByteSize(fileBase64) > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el tamaño máximo de 10 MB');
  }

  const { data, error } = await supabase.functions.invoke('analyze-loans-document', {
    body: { fileBase64, mimeType },
  });

  if (error) {
    throw new Error(error.message ?? 'Error al analizar el documento');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return (data?.items ?? []) as LoanItem[];
}
