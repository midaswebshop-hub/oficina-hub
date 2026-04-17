// lib/agents.js
// ============================================================
// CONFIGURACIÓN DE LOS 3 AGENTES DE PRODUCCIÓN
// ============================================================

export const AGENTS = [
  {
    id: "dropshipping",
    name: "Dropshipping Agent",
    description: "Busca productos ganadores cada 6 horas",
    url: "https://dropshipping-agent-zkn1.onrender.com",
    platform: "Render",
    color: "#3B82F6",
    endpoints: {
      status: "/api/agent?action=status",
      products: "/api/agent?action=products",
      runs: "/api/agent?action=runs",
    },
  },
  {
    id: "landing",
    name: "Landing Page Agent",
    description: "Crea paginas de venta y publica en Shopify",
    url: "https://landing-page-agent-m2z7.onrender.com",
    platform: "Render",
    color: "#10B981",
    endpoints: {
      status: "/api/landing?action=status",
      list: "/api/landing?action=list",
    },
  },
  {
    id: "ads",
    name: "Ads Agent PRO",
    description: "Crea y optimiza campanas en Meta Ads",
    url: "https://ads-agent-nine.vercel.app",
    platform: "Vercel",
    color: "#7C3AED",
    endpoints: {
      status: "/api/ads?action=status",
      list: "/api/ads?action=list",
      analytics: "/api/ads?action=analytics&days=7",
    },
  },
];

// Consultar un endpoint con timeout
export async function fetchAgent(baseUrl, endpoint, timeoutMs = 10000) {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Consultar todos los agentes en paralelo
export async function fetchAllAgents() {
  const results = {};

  await Promise.all(
    AGENTS.map(async (agent) => {
      const statusResult = await fetchAgent(agent.url, agent.endpoints.status);
      results[agent.id] = {
        ...agent,
        online: statusResult.ok,
        status: statusResult.ok ? statusResult.data : null,
        error: statusResult.ok ? null : statusResult.error,
        checkedAt: new Date().toISOString(),
      };
    })
  );

  return results;
}
