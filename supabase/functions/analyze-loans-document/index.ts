import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ANALYSIS_PROMPT = `Sos un asistente especializado en extraer registros de préstamos de documentos escritos a mano, planillas Excel, imágenes o PDFs.

Tu tarea es identificar cada préstamo otorgado y devolver ÚNICAMENTE este JSON sin texto adicional:
{
  "items": [
    {
      "borrower_name": "nombre completo del prestatario",
      "borrower_dni": "DNI o número de documento (solo dígitos, sin puntos) o null",
      "borrower_phone": "teléfono o null",
      "principal_amount": 50000.00,
      "interest_rate": 5.0,
      "term_value": 12,
      "term_type": "months",
      "interest_type": "simple",
      "currency": "ARS",
      "delivery_date": "YYYY-MM-DD",
      "notes": "observaciones adicionales o null"
    }
  ]
}

═══════════════════════════════════════
EXTRACCIÓN DE CAMPOS
═══════════════════════════════════════
- borrower_name: nombre de la persona que recibió el préstamo (requerido)
- borrower_dni: solo números del DNI, sin puntos ni espacios. null si no aparece
- borrower_phone: teléfono con código de área. null si no aparece
- principal_amount: monto prestado en número (sin símbolos ni puntos de miles)
- interest_rate: tasa de interés en % (ej: 5 para 5%). Si no se menciona, usá 0
- term_value: cantidad de cuotas o períodos. Si no se menciona, usá 1
- term_type: "months" para cuotas mensuales (default), "weeks" para semanales
- interest_type: "simple" (default) o "french" si se menciona amortización francesa
- currency: "ARS" si es pesos argentinos (default), "USD" si es dólares
- delivery_date: fecha de entrega en formato YYYY-MM-DD. Si no se menciona, usá la fecha de hoy
- notes: cualquier anotación, observación o comentario adicional. null si no hay

═══════════════════════════════════════
DETECCIÓN DE MONEDA
═══════════════════════════════════════
- $, pesos, ARS → "ARS"
- USD, U$S, US$, dólares, dollar → "USD"
- Sin símbolo → "ARS" por defecto

═══════════════════════════════════════
DETECCIÓN DE FECHA
═══════════════════════════════════════
- Convertí cualquier formato de fecha a YYYY-MM-DD
- "15/03/2024" → "2024-03-15"
- "15 de marzo de 2024" → "2024-03-15"
- Si no hay fecha, usá la fecha de hoy en formato YYYY-MM-DD

═══════════════════════════════════════
CASOS ESPECIALES
═══════════════════════════════════════
- Si el documento tiene una tabla, cada fila es un préstamo diferente
- Si es una lista, cada ítem con nombre + monto es un préstamo
- Un documento puede tener múltiples préstamos — extraelos todos
- Si el monto tiene puntos de miles (ej: "50.000"), convertilo a número (50000)
- Ignorá filas de totales, encabezados o resúmenes

Si no encontrás ningún préstamo, devolvé: {"items": []}`;

interface LoanItem {
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

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: ANALYSIS_PROMPT },
            { inline_data: { mime_type: mimeType, data: fileBase64 } },
          ],
        }],
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

    let parsed: { items: LoanItem[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { items: [] };
      }
    }

    // Sanitizar y normalizar los datos
    const sanitized = (parsed.items || [])
      .filter((item) => item.borrower_name && item.principal_amount > 0)
      .map((item) => ({
        ...item,
        interest_rate: item.interest_rate ?? 0,
        term_value: item.term_value ?? 1,
        term_type: item.term_type === 'weeks' ? 'weeks' : 'months',
        interest_type: item.interest_type === 'french' ? 'french' : 'simple',
        currency: item.currency === 'USD' ? 'USD' : 'ARS',
      }));

    return new Response(
      JSON.stringify({ items: sanitized }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
