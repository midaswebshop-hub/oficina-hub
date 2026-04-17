// lib/workflow.js
// ============================================================
// WORKFLOWS — Cadenas de acciones entre agentes
// ============================================================

import { fetchAgent, postAgent, AGENTS } from "./agents";

// Lanzar producto: Dropshipping → Landing → Ads (cadena completa)
export async function workflowLaunchProduct(options = {}) {
  const steps = [];
  const errors = [];

  // Step 1: Buscar productos
  steps.push({ agent: "dropshipping", action: "Buscando productos ganadores", status: "running", startedAt: new Date().toISOString() });

  const searchResult = await postAgent(AGENTS[0].url, "/api/agent?action=run", {});
  steps[0].status = searchResult.ok ? "done" : "error";
  steps[0].result = searchResult.ok ? "Busqueda completada" : searchResult.error;
  if (!searchResult.ok) {
    errors.push("Dropshipping Agent fallo en la busqueda");
    return { ok: false, steps, errors, message: "Fallo en busqueda de productos" };
  }

  // Step 2: Crear landings automaticas
  steps.push({ agent: "landing", action: "Creando landing pages", status: "running", startedAt: new Date().toISOString() });

  const landingResult = await postAgent(AGENTS[1].url, "/api/landing?action=auto-create", {});
  steps[1].status = landingResult.ok ? "done" : "error";
  steps[1].result = landingResult.ok ? "Landings creadas" : landingResult.error;
  if (!landingResult.ok) {
    errors.push("Landing Agent fallo al crear paginas");
    return { ok: false, steps, errors, message: "Fallo al crear landings" };
  }

  // Step 3: Monitorear/crear campañas
  steps.push({ agent: "ads", action: "Preparando campanas Meta Ads", status: "running", startedAt: new Date().toISOString() });

  const adsResult = await postAgent(AGENTS[2].url, "/api/ads?action=monitor", {});
  steps[2].status = adsResult.ok ? "done" : "error";
  steps[2].result = adsResult.ok ? "Campanas revisadas" : adsResult.error;
  if (!adsResult.ok) {
    errors.push("Ads Agent fallo");
  }

  return {
    ok: errors.length === 0,
    steps,
    errors,
    message: errors.length === 0 ? "Workflow completado — productos buscados, landings creadas, ads monitoreadas" : `Completado con ${errors.length} error(es)`,
    completedAt: new Date().toISOString(),
  };
}

// Health check profundo de todos los agentes
export async function workflowHealthCheck() {
  const results = {};

  for (const agent of AGENTS.filter(a => a.url)) {
    const start = Date.now();
    const r = await fetchAgent(agent.url, agent.endpoints.status, 8000);
    const latency = Date.now() - start;

    results[agent.id] = {
      online: r.ok,
      latency: `${latency}ms`,
      latencyScore: latency < 1000 ? "fast" : latency < 3000 ? "normal" : "slow",
      error: r.error || null,
      dataIntegrity: r.ok ? "ok" : "unknown",
    };
  }

  return { ok: true, results, checkedAt: new Date().toISOString() };
}
