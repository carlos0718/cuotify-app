import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ANALYSIS_PROMPT = `Sos un asistente especializado en analizar resúmenes de tarjeta de crédito argentinos.

Tu tarea es extraer DOS tipos de ítems del resumen:
1. CUOTAS ACTIVAS: compras en cuotas que todavía tienen pagos pendientes
2. SUSCRIPCIONES: cobros mensuales recurrentes de servicios (streaming, gym, seguros, etc.)

Devolvé ÚNICAMENTE este JSON sin texto adicional:
{
  "bank_name": "nombre del banco emisor (ej: Banco BBVA, Banco Galicia, HSBC, Santander, Macro, Naranja X, Mercado Pago, etc.)",
  "card_brand": "marca de la tarjeta (Visa, Mastercard, American Express, Cabal, Naranja)",
  "items": [
    {
      "creditor_name": "nombre del comercio",
      "description": "descripción del producto o servicio",
      "installment_amount": 1500.00,
      "installments_remaining": 9,
      "total_installments": 12,
      "currency": "ARS",
      "type": "installment"
    }
  ]
}

═══════════════════════════════════════
REGLA 1 — CUOTAS COMPLETADAS → EXCLUIR
═══════════════════════════════════════
Si ves un formato tipo "cuota X de Y" o "X/Y":
- Si X < Y → INCLUIR (aún quedan cuotas). installments_remaining = Y - X
- Si X = Y → EXCLUIR COMPLETAMENTE (ya está pagada)
Ejemplos:
  "cuota 3 de 12" → INCLUIR, installments_remaining = 9, total_installments = 12 ✅
  "cuota 12 de 12" → EXCLUIR ❌
  "3/6" → INCLUIR, installments_remaining = 3, total_installments = 6 ✅
  "6/6" → EXCLUIR ❌

═══════════════════════════════════════
REGLA 2 — SUSCRIPCIONES → INCLUIR
═══════════════════════════════════════
Incluí cobros mensuales recurrentes como:
- Streaming: Netflix, Disney+, HBO, Spotify, YouTube Premium, Amazon Prime, Apple TV, Paramount+
- Tecnología: iCloud, Google One, Dropbox, Adobe, Microsoft 365
- Gimnasios, clubes, membresías
- Seguros (auto, vida, hogar, celular)
- Dominios, hosting, VPN
- Cualquier cobro sin número de cuotas que se repite cada mes
Para suscripciones: type = "subscription", installments_remaining = 0, total_installments = 0

═══════════════════════════════════════
REGLA 3 — EXCLUIR SIEMPRE
═══════════════════════════════════════
- Resumen total del período
- Pagos únicos sin cuotas (supermercado, nafta, restaurante)
- Intereses, cargos administrativos, IVA sobre intereses
- Mínimo a pagar / total a pagar del resumen

═══════════════════════════════════════
REGLA 4 — MONEDA
═══════════════════════════════════════
- Si ves $, pesos, ARS → currency = "ARS"
- Si ves USD, U$S, US$, dólares → currency = "USD"
- Si hay duda → "ARS"

Si no encontrás ningún ítem válido, devolvé: {"items": []}`;

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface CreditCardItem {
  creditor_name: string;
  description: string;
  installment_amount: number;
  installments_remaining: number;
  total_installments: number;
  currency: string;
  type: 'installment' | 'subscription';
}

interface AnalysisResult {
  bank_name: string;
  card_brand: string;
  items: CreditCardItem[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileBase64, mimeType } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'Se requieren fileBase64 y mimeType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parts: GeminiPart[] = [
      { text: ANALYSIS_PROMPT },
      { inline_data: { mime_type: mimeType, data: fileBase64 } },
    ];

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: `Error en Gemini API: ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return new Response(
        JSON.stringify({ items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed: AnalysisResult;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { bank_name: '', card_brand: '', items: [] };
      }
    }

    // Filtrar cuotas completadas de forma programática (no confiar solo en el prompt)
    const filteredItems = (parsed.items || []).filter((item) => {
      if (item.type === 'subscription') return true;
      return item.installments_remaining > 0;
    });

    return new Response(
      JSON.stringify({
        bank_name: parsed.bank_name || '',
        card_brand: parsed.card_brand || '',
        items: filteredItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
