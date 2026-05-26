const SUPABASE_TABLE = "epis";
const SUPABASE_SELECT = "id,name,ca,category,lot,valid_until,total_stock,in_use,min_stock,department,supplier,notes";

async function listEpis() {
  return supabaseRequest(`?select=${SUPABASE_SELECT}&order=valid_until.asc,created_at.desc`);
}

async function createEpi(payload) {
  return supabaseRequest(`?select=${SUPABASE_SELECT}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
}

async function updateEpi(id, payload) {
  const data = await supabaseRequest(`?id=eq.${encodeURIComponent(id)}&select=${SUPABASE_SELECT}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });

  if (!Array.isArray(data) || !data.length) {
    const error = new Error("EPI nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  return data;
}

async function deleteEpi(id) {
  await supabaseRequest(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true };
}

async function supabaseRequest(pathname, options = {}) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variaveis de ambiente da Vercel.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${SUPABASE_TABLE}${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = parseJsonResponse(text);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Erro Supabase ${response.status}`);
  }

  return payload;
}

function parseJsonResponse(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  console.error(error);
  sendJson(response, error.statusCode || 500, { error: error.message || "Erro interno do servidor." });
}

module.exports = {
  createEpi,
  deleteEpi,
  listEpis,
  readJsonBody,
  sendError,
  sendJson,
  updateEpi
};
