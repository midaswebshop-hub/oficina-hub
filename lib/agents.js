// lib/agents.js
// ============================================================
// CONFIGURACIÓN DE AGENTES + LÓGICA DE INTERACCIÓN
// ============================================================

export const AGENTS = [
  {
    id: "dropshipping",
    name: "Dropshipping Agent",
    role: "Buscador de productos",
    avatar: "D",
    description: "Busca productos ganadores cada 6 horas con scoring de 8 criterios",
    url: "https://dropshipping-agent-zkn1.onrender.com",
    platform: "Render",
    color: "#3B82F6",
    endpoints: {
      status: "/api/agent?action=status",
      products: "/api/agent?action=products",
      runs: "/api/agent?action=runs",
      run: "/api/agent?action=run",
    },
  },
  {
    id: "landing",
    name: "Landing Page Agent",
    role: "Creador de paginas",
    avatar: "L",
    description: "Genera copy + HTML + publica en Shopify automaticamente",
    url: "https://landing-page-agent-m2z7.onrender.com",
    platform: "Render",
    color: "#10B981",
    endpoints: {
      status: "/api/landing?action=status",
      list: "/api/landing?action=list",
      create: "/api/landing?action=auto-create",
    },
  },
  {
    id: "ads",
    name: "Ads Agent PRO",
    role: "Campanas Meta Ads",
    avatar: "A",
    description: "Crea, monitorea y optimiza campanas en Meta Ads con IA",
    url: "https://ads-agent-nine.vercel.app",
    platform: "Vercel",
    color: "#7C3AED",
    endpoints: {
      status: "/api/ads?action=status",
      list: "/api/ads?action=list",
      analytics: "/api/ads?action=analytics&days=7",
      monitor: "/api/ads?action=monitor",
    },
  },
  {
    id: "leader",
    name: "Leader Agent",
    role: "Supervisor y optimizador",
    avatar: "K",
    description: "Supervisa los 3 agentes, detecta problemas y propone mejoras",
    url: null,
    platform: "Hub",
    color: "#F59E0B",
    endpoints: {},
  },
];

// Consultar endpoint con timeout
export async function fetchAgent(baseUrl, endpoint, timeoutMs = 12000) {
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

// POST a un agente
export async function postAgent(baseUrl, endpoint, body = {}, timeoutMs = 30000) {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Estado completo de todos los agentes
export async function fetchAllStatus() {
  const results = {};

  await Promise.all(
    AGENTS.filter(a => a.url).map(async (agent) => {
      const r = await fetchAgent(agent.url, agent.endpoints.status);
      results[agent.id] = {
        online: r.ok,
        data: r.ok ? r.data : null,
        error: r.ok ? null : r.error,
        checkedAt: new Date().toISOString(),
      };
    })
  );

  return results;
}

// ─── LEADER: ANALIZAR Y PROPONER MEJORAS ──────────────────
export function leaderAnalyze(agentStatus) {
  const issues = [];
  const suggestions = [];
  const interactions = [];
  const ds = agentStatus.dropshipping;
  const lp = agentStatus.landing;
  const ads = agentStatus.ads;

  // 1. Agentes caídos
  if (!ds?.online) issues.push({ severity: "critical", agent: "dropshipping", message: "Dropshipping Agent esta caido — no se buscan productos" });
  if (!lp?.online) issues.push({ severity: "critical", agent: "landing", message: "Landing Agent esta caido — el flujo de produccion esta roto" });
  if (!ads?.online) issues.push({ severity: "critical", agent: "ads", message: "Ads Agent esta caido — no se crean campanas" });

  // 2. Flujo roto: productos sin landings
  const totalProducts = ds?.data?.stats?.totalProducts || ds?.data?.recentProducts?.length || 0;
  const totalLandings = lp?.data?.published || lp?.data?.total || 0;
  if (totalProducts > 0 && totalLandings === 0 && lp?.online) {
    issues.push({ severity: "high", agent: "landing", message: `Hay ${totalProducts} productos encontrados pero 0 landings creadas` });
    suggestions.push({ from: "leader", to: "landing", action: "Crear landings automaticas para productos con score >= 8", priority: "alta" });
    interactions.push({ from: "leader", to: "landing", type: "suggestion", message: `Tienes ${totalProducts} productos esperando. Deberias crear landings para los de mayor score.` });
  }

  // 3. Landings sin campañas
  const totalCampaigns = ads?.data?.total || 0;
  const activeCampaigns = ads?.data?.active || 0;
  if (totalLandings > 0 && totalCampaigns === 0 && ads?.online) {
    issues.push({ severity: "high", agent: "ads", message: `Hay ${totalLandings} landings publicadas pero 0 campanas creadas` });
    suggestions.push({ from: "leader", to: "ads", action: "Crear campanas para landings publicadas via Autopilot", priority: "alta" });
    interactions.push({ from: "leader", to: "ads", type: "suggestion", message: `Hay ${totalLandings} landings listas. Usa el Autopilot para crear campanas.` });
  }

  // 4. Campañas pausadas sin activar
  const pausedCampaigns = ads?.data?.paused || 0;
  if (pausedCampaigns > 0 && activeCampaigns === 0) {
    issues.push({ severity: "medium", agent: "ads", message: `${pausedCampaigns} campanas pausadas y 0 activas — no hay gasto publicitario` });
    suggestions.push({ from: "leader", to: "ads", action: "Activar al menos 1 campana para generar datos", priority: "media" });
    interactions.push({ from: "leader", to: "ads", type: "nudge", message: `Tienes ${pausedCampaigns} campanas pausadas. Activa al menos una para empezar a generar datos.` });
  }

  // 5. Meta Ads sin pixel
  if (ads?.online && !ads?.data?.metaConnected) {
    issues.push({ severity: "high", agent: "ads", message: "Meta Ads no esta conectado — no se pueden crear campanas" });
  }

  // 6. Gasto sin conversiones
  const weekSpend = parseFloat(ads?.data?.weekSpend || 0);
  const weekConversions = ads?.data?.weekConversions || 0;
  if (weekSpend > 10 && weekConversions === 0) {
    issues.push({ severity: "high", agent: "ads", message: `$${weekSpend.toFixed(2)} gastados sin conversiones — revisar creativos y landing` });
    suggestions.push({ from: "leader", to: "ads", action: "Pausar campanas con CPC alto y revisar copies", priority: "alta" });
    interactions.push({ from: "leader", to: "dropshipping", type: "feedback", message: `Los productos actuales no estan convirtiendo. Necesito productos con mayor potencial viral.` });
  }

  // 7. ROAS bueno — escalar
  const weekRoas = parseFloat(ads?.data?.weekRoas || 0);
  if (weekRoas >= 2 && activeCampaigns > 0) {
    suggestions.push({ from: "leader", to: "ads", action: `ROAS de ${weekRoas}x — escalar presupuesto de campanas ganadoras`, priority: "alta" });
    interactions.push({ from: "leader", to: "dropshipping", type: "feedback", message: `Las campanas estan funcionando (ROAS ${weekRoas}x). Busca mas productos similares.` });
    interactions.push({ from: "leader", to: "landing", type: "feedback", message: `Las campanas convierten bien. Duplica la landing ganadora a otros paises.` });
  }

  // 8. Dropshipping activo pero sin ejecutar recientemente
  const lastRun = ds?.data?.lastRun?.completedAt;
  if (lastRun) {
    const hoursSinceRun = (Date.now() - new Date(lastRun).getTime()) / 3600000;
    if (hoursSinceRun > 12) {
      issues.push({ severity: "medium", agent: "dropshipping", message: `Ultima busqueda hace ${Math.round(hoursSinceRun)}h — deberia ser cada 6h` });
      interactions.push({ from: "leader", to: "dropshipping", type: "nudge", message: `Llevas ${Math.round(hoursSinceRun)}h sin buscar productos. Ejecuta una busqueda.` });
    }
  }

  // Leader siempre da un resumen
  const onlineCount = [ds, lp, ads].filter(a => a?.online).length;
  const leaderStatus = onlineCount === 3 ? "working" : onlineCount >= 1 ? "alert" : "error";
  const leaderMessage = issues.length === 0
    ? "Todo en orden. Los 3 agentes estan operativos."
    : `Detecte ${issues.length} problema${issues.length > 1 ? "s" : ""}. ${issues.filter(i => i.severity === "critical").length} critico${issues.filter(i => i.severity === "critical").length !== 1 ? "s" : ""}.`;

  return {
    leaderStatus,
    leaderMessage,
    issues,
    suggestions,
    interactions,
    summary: {
      onlineAgents: onlineCount,
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === "critical").length,
      totalSuggestions: suggestions.length,
    },
  };
}
