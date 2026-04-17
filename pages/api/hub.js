// pages/api/hub.js
// ============================================================
// API CENTRAL — Consulta los 3 agentes y consolida datos
// ============================================================

import { AGENTS, fetchAgent, fetchAllAgents } from "../../lib/agents";

export default async function handler(req, res) {
  const action = req.query.action;

  try {
    // Estado de todos los agentes
    if (action === "status") {
      const agents = await fetchAllAgents();

      // Extraer métricas clave de cada agente
      const dropshipping = agents.dropshipping;
      const landing = agents.landing;
      const ads = agents.ads;

      const summary = {
        timestamp: new Date().toISOString(),
        systemHealth: [dropshipping, landing, ads].filter(a => a.online).length === 3 ? "operational" : [dropshipping, landing, ads].filter(a => a.online).length >= 2 ? "degraded" : "down",
        agents: {
          dropshipping: {
            online: dropshipping.online,
            error: dropshipping.error,
            lastRun: dropshipping.status?.lastRun?.completedAt || null,
            productsFound: dropshipping.status?.lastRun?.productsFound || 0,
            totalProducts: dropshipping.status?.stats?.totalProducts || dropshipping.status?.recentProducts?.length || 0,
            isActive: dropshipping.status?.config?.is_active ?? true,
          },
          landing: {
            online: landing.online,
            error: landing.error,
            total: landing.status?.total || 0,
            published: landing.status?.published || 0,
            drafts: landing.status?.drafts || 0,
            last24h: landing.status?.last24h || 0,
          },
          ads: {
            online: ads.online,
            error: ads.error,
            total: ads.status?.total || 0,
            active: ads.status?.active || 0,
            paused: ads.status?.paused || 0,
            weekSpend: ads.status?.weekSpend || "0",
            weekClicks: ads.status?.weekClicks || 0,
            weekConversions: ads.status?.weekConversions || 0,
            weekRoas: ads.status?.weekRoas || "0",
            metaConnected: ads.status?.metaConnected ?? false,
            supabaseConnected: ads.status?.supabaseConnected ?? false,
            telegramConnected: ads.status?.telegramConnected ?? false,
          },
        },
      };

      return res.json(summary);
    }

    // Actividad reciente consolidada
    if (action === "activity") {
      const activities = [];

      // Consultar cada agente en paralelo
      const [dropRes, landRes, adsRes] = await Promise.all([
        fetchAgent(AGENTS[0].url, AGENTS[0].endpoints.runs),
        fetchAgent(AGENTS[1].url, AGENTS[1].endpoints.list),
        fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.list),
      ]);

      // Dropshipping runs
      if (dropRes.ok) {
        for (const run of (dropRes.data?.runs || dropRes.data || []).slice(0, 5)) {
          activities.push({
            agent: "dropshipping",
            type: "run",
            title: `Busqueda completada — ${run.productsFound || run.products_found || 0} productos`,
            timestamp: run.completedAt || run.completed_at || run.created_at,
            color: "#3B82F6",
          });
        }
      }

      // Landing pages
      if (landRes.ok) {
        for (const lp of (landRes.data?.landings || landRes.data?.pages || []).slice(0, 5)) {
          activities.push({
            agent: "landing",
            type: "landing",
            title: `Landing: ${lp.product_name || lp.title || "Producto"}`,
            subtitle: lp.status === "published" ? "Publicada en Shopify" : "Borrador",
            timestamp: lp.created_at,
            color: "#10B981",
          });
        }
      }

      // Ads campaigns
      if (adsRes.ok) {
        for (const c of (adsRes.data?.campaigns || []).slice(0, 5)) {
          activities.push({
            agent: "ads",
            type: "campaign",
            title: `Campana: ${c.product_name}`,
            subtitle: `${c.status} — ${c.country_code} — $${c.budget_daily_usd}/dia`,
            timestamp: c.created_at,
            color: "#7C3AED",
          });
        }
      }

      // Ordenar por fecha
      activities.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

      return res.json({ activities: activities.slice(0, 15) });
    }

    // Analytics de ads
    if (action === "analytics") {
      const result = await fetchAgent(AGENTS[2].url, AGENTS[2].endpoints.analytics);
      return res.json(result.ok ? result.data : { daily: [], totals: {} });
    }

    return res.status(400).json({ error: `Accion no valida: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
