// lib/leader_ai.js
// ============================================================
// LEADER AI — Supervisor Inteligente con Gemini 2.5 Flash
// ============================================================

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// ─── CACHE SIMPLE ────────────────────────────────────────────
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── GEMINI API CALL CON RETRY ──────────────────────────────
async function callGemini(prompt, retries = 2) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const body = await res.json();
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini no devolvio contenido");

      // Parse JSON response
      try {
        return JSON.parse(text);
      } catch {
        // Si no es JSON valido, intentar extraer JSON del texto
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("Respuesta de Gemini no es JSON valido");
      }
    } catch (err) {
      if (attempt < retries && (err.name === "TimeoutError" || err.message.includes("fetch"))) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ─── SYSTEM PROMPT BASE ─────────────────────────────────────
const SYSTEM_CONTEXT = `Eres el LEADER AGENT (CTO virtual) de una empresa de e-commerce en LATAM.
Supervisas 3 agentes de produccion:
1. Dropshipping Agent — busca productos ganadores cada 6h (scoring de 8 criterios, fuentes: Dropi CO/CR/GT, AliExpress, TikTok)
2. Landing Page Agent — genera copy + HTML + publica en Shopify (template v5/v6, paises: CO/CR/GT)
3. Ads Agent PRO — crea y optimiza campanas Meta Ads (15 estrategias, 7 paises, autopilot)

El flujo es: Producto descubierto → Landing creada → Campana lanzada (pausada) → Optimizacion continua

REGLAS:
- Siempre responde en espanol
- Piensa como un CTO analizando su equipo de ingenieria
- Se especifico y accionable — nada generico
- Prioriza rentabilidad sobre volumen
- Identifica cuellos de botella en el flujo
- Usa datos concretos cuando los tengas`;

// ─── 1. ANALYZE AGENT ───────────────────────────────────────
export async function analyzeAgent(agentId, statusData) {
  const cacheKey = `analyze_${agentId}_${JSON.stringify(statusData).slice(0, 100)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `${SYSTEM_CONTEXT}

Analiza el estado del agente "${agentId}" con estos datos:
${JSON.stringify(statusData, null, 2)}

Responde en JSON con esta estructura exacta:
{
  "score": <numero 1-10>,
  "health": "<healthy|warning|critical>",
  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],
  "weaknesses": ["<debilidad 1>", "<debilidad 2>"],
  "improvements": ["<mejora especifica 1>", "<mejora especifica 2>", "<mejora especifica 3>"],
  "priority": "<que debe hacer este agente AHORA mismo>"
}

Se especifico basandote en los datos reales. No inventes metricas.`;

  try {
    const result = await callGemini(prompt);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    return { score: 0, health: "unknown", strengths: [], weaknesses: [], improvements: [], priority: `Error al analizar: ${err.message}`, _fallback: true };
  }
}

// ─── 2. GENERATE LEADER REPORT ──────────────────────────────
export async function generateLeaderReport(allAgentStatus, shopifyData) {
  const cacheKey = `leader_report_${Date.now() - (Date.now() % CACHE_TTL)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const prompt = `${SYSTEM_CONTEXT}

Genera un reporte ejecutivo completo. Datos actuales del sistema:

ESTADO DE AGENTES:
${JSON.stringify(allAgentStatus, null, 2)}

DATOS SHOPIFY:
${JSON.stringify(shopifyData || { ok: false, error: "Sin datos" }, null, 2)}

Responde en JSON con esta estructura exacta:
{
  "summary": "<resumen ejecutivo de 2-3 oraciones del estado general>",
  "agentReports": [
    {
      "agentId": "dropshipping",
      "status": "<operativo|degradado|caido>",
      "score": <1-10>,
      "keyFinding": "<hallazgo principal>",
      "action": "<accion recomendada>"
    },
    {
      "agentId": "landing",
      "status": "<operativo|degradado|caido>",
      "score": <1-10>,
      "keyFinding": "<hallazgo principal>",
      "action": "<accion recomendada>"
    },
    {
      "agentId": "ads",
      "status": "<operativo|degradado|caido>",
      "score": <1-10>,
      "keyFinding": "<hallazgo principal>",
      "action": "<accion recomendada>"
    }
  ],
  "flowAnalysis": {
    "bottleneck": "<donde esta el cuello de botella del flujo>",
    "flowHealth": "<fluido|lento|bloqueado>",
    "recommendation": "<como desbloquear o mejorar>"
  },
  "topPriority": "<LA cosa mas importante a hacer AHORA>",
  "leaderMessage": "<mensaje del Leader al equipo, tono motivador pero directo>"
}

Analiza el flujo completo: productos → landings → campanas → ventas. Detecta cuellos de botella reales.`;

  try {
    const result = await callGemini(prompt);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    return {
      summary: `Error generando reporte AI: ${err.message}. Usa el analisis estatico como fallback.`,
      agentReports: [],
      flowAnalysis: { bottleneck: "unknown", flowHealth: "unknown", recommendation: "Verificar conexion con Gemini API" },
      topPriority: "Resolver error de conexion con Gemini",
      leaderMessage: "No pude completar el analisis inteligente. Revisa la API key de Gemini.",
      _fallback: true,
    };
  }
}

// ─── 3. SUGGEST IMPROVEMENTS ────────────────────────────────
export async function suggestImprovements(agentId, statusData, recentHistory = null) {
  const cacheKey = `improve_${agentId}_${JSON.stringify(statusData).slice(0, 100)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const agentContexts = {
    dropshipping: `Este agente busca productos ganadores en Dropi (CO, CR, GT), AliExpress y TikTok.
Usa scoring de 8 criterios (margen, tendencia, competencia, envio, wow factor, etc).
Ejecuta cada 6h via GitHub Actions cron.
Metricas clave: score >= 9 es producto ganador, margen objetivo > 40%.
Puede mejorar: queries de busqueda, categorias, timing, fuentes, filtros de scoring.`,
    landing: `Este agente genera landings con copy persuasivo + HTML responsive + publica en Shopify.
Usa templates v5/v6, genera para CO, CR, GT.
Conecta con Dropi para precios por pais.
Metricas clave: tasa de publicacion, calidad de copy, conversion rate.
Puede mejorar: headlines, imagenes, CTAs, testimonios, pricing, urgencia, template.`,
    ads: `Este agente crea y optimiza campanas Meta Ads con 15 estrategias.
Soporta 7 paises, autopilot, optimizacion de presupuesto.
Metricas clave: CPC < $0.50, CTR > 2%, ROAS > 2x.
Puede mejorar: segmentacion, creativos, presupuesto, horarios, copy de anuncios, angulos.`,
  };

  const prompt = `${SYSTEM_CONTEXT}

Sugiere mejoras ESPECIFICAS y ACCIONABLES para el agente "${agentId}".

CONTEXTO DEL AGENTE:
${agentContexts[agentId] || "Agente desconocido"}

DATOS ACTUALES:
${JSON.stringify(statusData, null, 2)}

${recentHistory ? `HISTORIAL RECIENTE:\n${JSON.stringify(recentHistory, null, 2)}` : "Sin historial reciente disponible."}

Responde en JSON con esta estructura exacta:
{
  "improvements": [
    {
      "title": "<titulo corto>",
      "description": "<descripcion detallada de la mejora>",
      "difficulty": "<facil|media|dificil>",
      "expectedImpact": "<alto|medio|bajo>",
      "steps": ["<paso 1>", "<paso 2>", "<paso 3>"]
    }
  ],
  "estimatedImpact": "<descripcion del impacto general si se implementan todas>",
  "nextAction": "<LA primera accion concreta a tomar YA>"
}

Da al menos 3 mejoras y maximo 6. Se MUY especifico — nada generico como "mejorar el rendimiento".`;

  try {
    const result = await callGemini(prompt);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    return {
      improvements: [],
      estimatedImpact: `Error: ${err.message}`,
      nextAction: "Verificar conexion con Gemini API",
      _fallback: true,
    };
  }
}

// ─── 4. LEADER CHAT ─────────────────────────────────────────
export async function leaderChat(message, context) {
  // No cache para chat — cada pregunta es unica
  const prompt = `${SYSTEM_CONTEXT}

ESTADO ACTUAL DEL SISTEMA:
${JSON.stringify(context, null, 2)}

El usuario (dueno de la empresa) te hace esta pregunta:
"${message}"

Responde como el CTO/Leader del equipo. Se directo, usa datos del sistema cuando sea relevante.
Responde en JSON con esta estructura:
{
  "response": "<tu respuesta completa al usuario>",
  "suggestions": ["<sugerencia relacionada 1>", "<sugerencia relacionada 2>"],
  "relatedAgents": ["<agentId que se menciona o es relevante>"]
}`;

  try {
    return await callGemini(prompt);
  } catch (err) {
    return {
      response: `Error al procesar tu pregunta: ${err.message}. Verifica que la API key de Gemini este configurada correctamente.`,
      suggestions: ["Verificar GEMINI_API_KEY en .env.local", "Revisar el status de los agentes manualmente"],
      relatedAgents: [],
      _fallback: true,
    };
  }
}
