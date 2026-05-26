const SUPABASE_TABLE = "epis";
const SUPABASE_SELECT = "id,name,ca,category,lot,valid_until,total_stock,in_use,min_stock,department,supplier,notes";

module.exports = async function handler(request, response) {
  try {
    const id = getIdFromUrl(request.url);

    if (request.method === "GET" && !id) {
      const data = await supabaseRequest(`?select=${SUPABASE_SELECT}&order=valid_until.asc,created_at.desc`);
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "POST" && !id) {
      const payload = await readJsonBody(request);
      const data = await supabaseRequest(`?select=${SUPABASE_SELECT}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });
      sendJson(response, 201, data);
      return;
    }

    if (request.method === "PUT" && id) {
      const payload = await readJsonBody(request);
      const data = await supabaseRequest(`?id=eq.${encodeURIComponent(id)}&select=${SUPABASE_SELECT}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload)
      });

      if (!Array.isArray(data) || !data.length) {
        sendJson(response, 404, { error: "EPI nao encontrado." });
        return;
      }

      sendJson(response, 200, data);
      return;
    }

    if (request.method === "DELETE" && id) {
      await supabaseRequest(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message || "Erro interno do servidor." });
  }
};

function getIdFromUrl(rawUrl) {
  const pathname = new URL(rawUrl, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/epis\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function supabaseRequest(pathname, options = {}) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variaveis de ambiente.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${SUPABASE_TABLE}${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Erro Supabase ${response.status}`);
  }

  return payload;
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
