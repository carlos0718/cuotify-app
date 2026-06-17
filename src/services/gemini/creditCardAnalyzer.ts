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
