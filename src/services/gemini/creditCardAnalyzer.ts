import { supabase } from '../supabase/client';

export interface CreditCardItem {
  creditor_name: string;
  description: string;
  installment_amount: number;
  installments_remaining: number;
  total_installments: number;
  currency: 'ARS' | 'USD';
  type: 'installment' | 'subscription';
}

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function getMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

// Pre-chequeo de tamaño del lado del cliente (S10): corta antes de subir el base64
// si ya se sabe que supera el tope. El borde (Edge Function) lo vuelve a validar;
// esto es solo UX para no gastar ancho de banda ni tiempo en un archivo que será
// rechazado. Debe quedar alineado con MAX_FILE_BYTES de las Edge Functions.
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export function base64ByteSize(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
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

export interface AnalysisResult {
  bankName: string;
  cardBrand: string;
  items: CreditCardItem[];
}

export async function analyzeCreditCardReceipt(fileUri: string): Promise<AnalysisResult> {
  const mimeType = getMimeType(fileUri);
  const fileBase64 = await fileUriToBase64(fileUri);

  if (base64ByteSize(fileBase64) > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el tamaño máximo de 10 MB');
  }

  const { data, error } = await supabase.functions.invoke('analyze-credit-card', {
    body: { fileBase64, mimeType },
  });

  if (error) {
    throw new Error(error.message ?? 'Error al analizar el resumen');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return {
    bankName: data?.bank_name ?? '',
    cardBrand: data?.card_brand ?? '',
    items: (data?.items ?? []) as CreditCardItem[],
  };
}
