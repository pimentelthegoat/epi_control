const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");

const ROOT = __dirname;
const FRONTEND_ROOT = path.resolve(ROOT, "..", "frontend");
const SUPABASE_TABLE = "epis";
const SUPABASE_SELECT = "id,name,ca,category,lot,valid_until,total_stock,in_use,min_stock,department,supplier,notes";

loadEnv();

const PORT = Number(process.env.PORT || 5500);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/epis")) {
      await handleApi(request, response, url);
      return;
    }

    await serveFrontend(request, response, url);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message || "Erro interno do servidor." });
  }
});

server.listen(PORT, () => {
  console.log(`Controle de EPI rodando em http://localhost:${PORT}`);
});

function loadEnv() {
  const envPath = path.join(ROOT, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

async function handleApi(request, response, url) {
  const idMatch = url.pathname.match(/^\/api\/epis\/([^/]+)$/);

  if (url.pathname === "/api/epis" && request.method === "GET") {
    const data = await supabaseRequest(`?select=${SUPABASE_SELECT}&order=valid_until.asc,created_at.desc`);
    sendJson(response, 200, data);
    return;
  }

  if (url.pathname === "/api/epis" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const data = await supabaseRequest(`?select=${SUPABASE_SELECT}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    });
    sendJson(response, 201, data);
    return;
  }

  if (idMatch && request.method === "PUT") {
    const payload = await readJsonBody(request);
    const data = await supabaseRequest(`?id=eq.${encodeURIComponent(idMatch[1])}&select=${SUPABASE_SELECT}`, {
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

  if (idMatch && request.method === "DELETE") {
    await supabaseRequest(`?id=eq.${encodeURIComponent(idMatch[1])}`, { method: "DELETE" });
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Rota nao encontrada." });
}

async function supabaseRequest(pathname, options = {}) {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.");
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
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new Error("JSON muito grande.");
    }

    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveFrontend(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Metodo nao permitido.");
    return;
  }

  const files = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/script.js": "script.js"
  };
  const fileName = files[url.pathname];

  if (!fileName) {
    sendText(response, 404, "Arquivo nao encontrado.");
    return;
  }

  const content = await fsp.readFile(path.join(FRONTEND_ROOT, fileName));
  response.writeHead(200, {
    "Content-Type": contentTypeFor(fileName),
    "Cache-Control": "no-store"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(content);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(message);
}

function contentTypeFor(fileName) {
  if (fileName.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (fileName.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  return "text/html; charset=utf-8";
}
