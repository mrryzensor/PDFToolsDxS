// Dynamic Gemini AI Service with Multi-Key Failover and Dynamic Model Discovery
// Supports: Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 2.0 Flash, Gemini 1.5 Flash, etc.
// Automatically discovers models from the official Google AI Studio list and falls back to newest available free tier models.

import { getStoredGeminiKeys, updateStoredGeminiKey } from './storage';

// Default prioritized model hierarchy (from newest free-tier to stable fallbacks)
// Covers the latest active models from Google AI Studio (Gemini 3.5 Flash, 2.5 Flash, 2.0 Flash, etc.)
export const DEFAULT_MODEL_PRIORITY = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

/**
 * Test a single API key: validates model access and executes a minimal ping generation
 */
export async function testGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: 'La API key está vacía' };
  }

  const cleanKey = apiKey.trim();
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;

  try {
    const res = await fetch(listUrl);
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || `Error HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }

    // Filter models that support generateContent
    const models = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
      }));

    // Test a real generation ping to confirm billing/quota status
    let generationWorking = false;
    let quotaError = null;

    for (const testModel of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.5-flash-lite']) {
      try {
        const pingRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${cleanKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }),
          }
        );
        const pingData = await pingRes.json();
        if (pingRes.ok && pingData.candidates?.[0]) {
          generationWorking = true;
          break;
        } else if (pingRes.status === 402 || (pingData?.error?.message && pingData.error.message.includes('prepayment'))) {
          quotaError = 'Tu cuenta en Google AI Studio no tiene créditos prepagos (Error 402 Prepayment credits depleted). Crea una clave nueva en un proyecto con capa gratuita de Google AI Studio.';
          break;
        } else if (pingRes.status === 429) {
          quotaError = 'Límite de cuota temporal excedido (429 Rate limit).';
          break;
        }
      } catch (e) {
        // Continue test
      }
    }

    if (!generationWorking && quotaError) {
      return { ok: false, error: quotaError, models };
    }

    return { ok: true, models, verified: generationWorking };
  } catch (err) {
    return { ok: false, error: err.message || 'Error de conexión con Google AI Studio' };
  }
}

/**
 * Generate Content with automatic failover across multiple API keys and dynamic models
 */
export async function generateContentWithFailover({ prompt, systemInstruction = '', responseSchema = null }) {
  const registeredKeys = getStoredGeminiKeys();

  if (!registeredKeys || registeredKeys.length === 0) {
    throw new Error(
      'No hay ninguna Gemini API Key registrada. Por favor agrega al menos una en el gestor de API Keys de Google AI Studio.'
    );
  }

  let lastError = null;

  // Try each API key sequentially
  for (let keyIndex = 0; keyIndex < registeredKeys.length; keyIndex++) {
    const keyRecord = registeredKeys[keyIndex];
    const apiKey = keyRecord.key;

    // For this key, try prioritized models
    for (const modelName of DEFAULT_MODEL_PRIORITY) {
      try {
        const result = await executeGeminiRequest({
          apiKey,
          modelName,
          prompt,
          systemInstruction,
          responseSchema,
        });

        // Mark key as valid and updated
        updateStoredGeminiKey(keyRecord.id, {
          status: 'valid',
          lastUsed: new Date().toISOString(),
          lastUsedModel: modelName,
        });

        return {
          text: result.text,
          parsed: result.parsed,
          modelUsed: modelName,
          keyUsedLabel: keyRecord.label,
        };
      } catch (err) {
        lastError = err;
        console.warn(`Falló con Key "${keyRecord.label}" y modelo "${modelName}":`, err.message);

        // If rate limit / quota exceeded, break model loop to try next key!
        if (err.status === 429 || (err.message && err.message.toLowerCase().includes('quota'))) {
          updateStoredGeminiKey(keyRecord.id, {
            status: 'quota_exceeded',
            lastError: err.message,
          });
          break; // jump to next key
        }

        // If invalid key, update status and jump to next key
        if (err.status === 400 || err.status === 403) {
          updateStoredGeminiKey(keyRecord.id, {
            status: 'invalid',
            lastError: err.message,
          });
          break;
        }

        // If model not found (404), continue inner loop to try next model with same key
        if (err.status === 404) {
          continue;
        }
      }
    }
  }

  throw new Error(
    `Todas las API Keys fallaron. Último error reportado: ${lastError?.message || 'Error desconocido'}`
  );
}

/**
 * Low-level execution for a single key and model
 */
async function executeGeminiRequest({ apiKey, modelName, prompt, systemInstruction, responseSchema }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const bodyPayload = {
    contents,
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
    },
  };

  if (systemInstruction) {
    bodyPayload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (responseSchema) {
    bodyPayload.generationConfig.responseMimeType = 'application/json';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data?.error?.message || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  const candidate = data.candidates?.[0];
  const textContent = candidate?.content?.parts?.[0]?.text || '';

  let parsed = null;
  if (responseSchema || textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
    try {
      // Clean possible markdown code fences
      const cleanJson = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      // not strict JSON, keep parsed as null
    }
  }

  return { text: textContent, parsed };
}
