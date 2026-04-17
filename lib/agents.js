// lib/agents.js
// ============================================================
// AGENTES + LEADER INTELLIGENCE + CAMPAIGN MANAGEMENT
// ============================================================

export const AGENTS = [
  { id:"dropshipping", name:"Dropshipping Agent", role:"Buscador de productos", avatar:"D", description:"Busca productos ganadores cada 6h con scoring de 8 criterios", url:"https://dropshipping-agent-zkn1.onrender.com", platform:"Render", color:"#3B82F6",
    endpoints:{ status:"/api/agent?action=status", products:"/api/agent?action=products", runs:"/api/agent?action=runs", run:"/api/agent?action=run" }},
  { id:"landing", name:"Landing Page Agent", role:"Creador de paginas", avatar:"L", description:"Genera copy + HTML + publica en Shopify", url:"https://landing-page-agent-m2z7.onrender.com", platform:"Render", color:"#10B981",
    endpoints:{ status:"/api/landing?action=status", list:"/api/landing?action=list", create:"/api/landing?action=auto-create" }},
  { id:"ads", name:"Ads Agent PRO", role:"Campanas Meta Ads", avatar:"A", description:"Crea, monitorea y optimiza campanas con IA", url:"https://ads-agent-nine.vercel.app", platform:"Vercel", color:"#7C3AED",
    endpoints:{ status:"/api/ads?action=status", list:"/api/ads?action=list", analytics:"/api/ads?action=analytics&days=14", monitor:"/api/ads?action=monitor", config:"/api/ads?action=config" }},
  { id:"leader", name:"Leader Agent", role:"Supervisor", avatar:"K", description:"Supervisa, detecta problemas y propone mejoras", url:null, platform:"Hub", color:"#F59E0B", endpoints:{} },
];

export async function fetchAgent(baseUrl, endpoint, timeoutMs = 12000) {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (err) { return { ok: false, error: err.message }; }
}

export async function postAgent(baseUrl, endpoint, body = {}, timeoutMs = 30000) {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, data: await res.json() };
  } catch (err) { return { ok: false, error: err.message }; }
}

export async function fetchAllStatus() {
  const results = {};
  await Promise.all(AGENTS.filter(a => a.url).map(async (agent) => {
    const r = await fetchAgent(agent.url, agent.endpoints.status);
    results[agent.id] = { online: r.ok, data: r.ok ? r.data : null, error: r.ok ? null : r.error, checkedAt: new Date().toISOString() };
  }));
  return results;
}

// ─── CAMPAIGN MANAGEMENT ──────────────────────────────────
export async function getCampaigns() {
  const r = await fetchAgent(AGENTS[2].url, "/api/ads?action=list");
  return r.ok ? (r.data?.campaigns || []) : [];
}

export async function toggleCampaign(id, activate) {
  const action = activate ? "activate" : "pause";
  return postAgent(AGENTS[2].url, `/api/ads?action=${action}`, { id });
}

export async function getCampaignMetrics(id) {
  const r = await fetchAgent(AGENTS[2].url, `/api/ads?action=metrics&id=${id}`);
  return r.ok ? r.data : null;
}

// ─── LEADER INTELLIGENCE (expanded) ───────────────────────
export function leaderAnalyze(agentStatus, shopifyData = null) {
  const issues = [], suggestions = [], interactions = [];
  const ds = agentStatus.dropshipping, lp = agentStatus.landing, ads = agentStatus.ads;

  // 1. Agentes caídos
  if (!ds?.online) { issues.push({ severity:"critical", agent:"dropshipping", message:"Dropshipping Agent caido — no se buscan productos", fix:"Verificar Render: puede estar en cold start. Abrir el dashboard para despertarlo." }); }
  if (!lp?.online) { issues.push({ severity:"critical", agent:"landing", message:"Landing Agent caido — el flujo esta roto", fix:"Render apaga instancias gratuitas por inactividad. Abrir dashboard o hacer upgrade a paid." }); }
  if (!ads?.online) { issues.push({ severity:"critical", agent:"ads", message:"Ads Agent caido — no se crean campanas", fix:"Verificar Vercel dashboard. Revisar logs de deploy." }); }

  // 2. Productos sin landings
  const totalProducts = ds?.data?.stats?.totalProducts || ds?.data?.recentProducts?.length || 0;
  const totalLandings = lp?.data?.published || lp?.data?.total || 0;
  if (totalProducts > 5 && totalLandings === 0 && lp?.online) {
    issues.push({ severity:"high", agent:"landing", message:`${totalProducts} productos encontrados pero 0 landings — se pierde oportunidad`, fix:"Ejecutar 'Crear Landings' desde el Centro de Comando" });
    suggestions.push({ from:"leader", to:"landing", action:`Crear landings para los ${Math.min(5, totalProducts)} productos con mejor score`, priority:"alta", impact:"Desbloquea el flujo completo hacia campanas" });
    interactions.push({ from:"leader", to:"landing", type:"order", message:`Tienes ${totalProducts} productos esperando. Prioriza los de score >= 8 y crea landings ahora.` });
  }

  // 3. Landings sin campañas
  const totalCampaigns = ads?.data?.total || 0;
  const activeCampaigns = ads?.data?.active || 0;
  if (totalLandings > 0 && totalCampaigns === 0 && ads?.online) {
    issues.push({ severity:"high", agent:"ads", message:`${totalLandings} landings publicadas pero 0 campanas — el trafico no llega`, fix:"Ir a Ads Agent → Autopilot y crear campanas para las landings" });
    suggestions.push({ from:"leader", to:"ads", action:"Crear campanas con Autopilot para landings publicadas", priority:"alta", impact:"Empieza a generar trafico y datos" });
    interactions.push({ from:"leader", to:"ads", type:"order", message:`Hay ${totalLandings} landings listas en Shopify. Crea campanas con el Autopilot.` });
  }

  // 4. Todo pausado
  const pausedCampaigns = ads?.data?.paused || 0;
  if (pausedCampaigns > 0 && activeCampaigns === 0) {
    issues.push({ severity:"medium", agent:"ads", message:`${pausedCampaigns} campanas pausadas, 0 activas — $0 en gasto publicitario`, fix:"Activar al menos 1 campana desde Gestion de Campanas" });
    suggestions.push({ from:"leader", to:"ads", action:"Activar la campana con mejor copy/angulo para empezar a generar datos", priority:"media", impact:"Primeros datos de CPC, CTR y conversion" });
    interactions.push({ from:"leader", to:"ads", type:"nudge", message:`${pausedCampaigns} campanas esperando. Activa al menos 1 para obtener datos reales de Meta.` });
  }

  // 5. Meta desconectado
  if (ads?.online && ads?.data?.metaConnected === false) {
    issues.push({ severity:"critical", agent:"ads", message:"Meta Ads API desconectada — token expirado o invalido", fix:"Verificar META_ACCESS_TOKEN en Vercel environment variables" });
  }

  // 6. Gasto sin conversiones
  const weekSpend = parseFloat(ads?.data?.weekSpend || 0);
  const weekConversions = ads?.data?.weekConversions || 0;
  if (weekSpend > 10 && weekConversions === 0) {
    issues.push({ severity:"high", agent:"ads", message:`$${weekSpend.toFixed(2)} gastados sin conversiones`, fix:"Revisar creativos, landing page, y segmentacion. Pausar campanas con CPC > $2" });
    interactions.push({ from:"leader", to:"ads", type:"alert", message:`Llevas $${weekSpend.toFixed(2)} gastados sin una sola conversion. Pausa las campanas con peor CTR y revisa los copies.` });
    interactions.push({ from:"leader", to:"dropshipping", type:"feedback", message:`Los productos actuales no convierten. Busca productos con mayor efecto WOW y potencial viral.` });
    interactions.push({ from:"leader", to:"landing", type:"feedback", message:`Las landings no convierten. Revisa el headline, las imagenes y el CTA. Prueba agregar mas testimonios.` });
  }

  // 7. ROAS positivo
  const weekRoas = parseFloat(ads?.data?.weekRoas || 0);
  if (weekRoas >= 1.5 && activeCampaigns > 0) {
    suggestions.push({ from:"leader", to:"ads", action:`ROAS de ${weekRoas}x — escalar presupuesto de campanas ganadoras`, priority:"alta", impact:"Mas ventas con el mismo ROAS" });
    interactions.push({ from:"leader", to:"dropshipping", type:"positive", message:`ROAS ${weekRoas}x — las campanas funcionan! Busca mas productos del mismo nicho/categoria.` });
    interactions.push({ from:"leader", to:"landing", type:"positive", message:`Las ventas estan llegando. Duplica la landing ganadora para otros paises (CR, GT, MX).` });
  }

  // 8. Cron no ejecuta
  const lastRun = ds?.data?.lastRun?.completedAt;
  if (lastRun) {
    const hoursSince = (Date.now() - new Date(lastRun).getTime()) / 3600000;
    if (hoursSince > 12) {
      issues.push({ severity:"medium", agent:"dropshipping", message:`Ultima busqueda hace ${Math.round(hoursSince)}h — deberia ser cada 6h`, fix:"Verificar GitHub Actions cron job o ejecutar busqueda manual" });
      interactions.push({ from:"leader", to:"dropshipping", type:"nudge", message:`Llevas ${Math.round(hoursSince)}h sin buscar. El cron deberia ejecutarse cada 6h. Ejecuta una busqueda manual.` });
    }
  }

  // 9. Shopify sin productos activos
  if (shopifyData?.ok) {
    const activeProds = shopifyData.products?.active || 0;
    if (activeProds === 0) {
      issues.push({ severity:"high", agent:"landing", message:"0 productos activos en Shopify — la tienda esta vacia", fix:"Crear landings o publicar productos manualmente en Shopify" });
    }
    const revenue7d = parseFloat(shopifyData.orders?.revenue7d || 0);
    if (revenue7d > 0 && weekSpend > 0) {
      const realRoas = revenue7d / weekSpend;
      if (realRoas < 1) {
        issues.push({ severity:"high", agent:"ads", message:`ROI negativo: $${revenue7d.toFixed(0)} revenue vs $${weekSpend.toFixed(2)} gasto (ROAS real: ${realRoas.toFixed(2)}x)`, fix:"Pausar campanas no rentables o mejorar conversion rate" });
      }
    }
  }

  // 10. Oportunidades de expansion
  if (totalProducts > 10 && totalLandings > 3 && activeCampaigns > 0) {
    suggestions.push({ from:"leader", to:"landing", action:"Duplicar landings ganadoras a nuevos paises (CR, GT, MX)", priority:"media", impact:"Nuevos mercados con producto ya validado" });
  }

  const onlineCount = [ds, lp, ads].filter(a => a?.online).length;
  const leaderStatus = onlineCount === 3 && issues.filter(i=>i.severity==="critical").length === 0 ? "working" : "alert";
  const leaderMessage = issues.length === 0
    ? "Sistema operativo. Los 3 agentes estan online y funcionando."
    : `${issues.length} problema${issues.length > 1 ? "s" : ""} detectado${issues.length > 1 ? "s" : ""}. ${issues.filter(i => i.severity === "critical").length} critico${issues.filter(i => i.severity === "critical").length !== 1 ? "s" : ""}.`;

  return { leaderStatus, leaderMessage, issues, suggestions, interactions, summary: { onlineAgents: onlineCount, totalIssues: issues.length, criticalIssues: issues.filter(i => i.severity === "critical").length, totalSuggestions: suggestions.length } };
}
