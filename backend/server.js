const fs = require("fs");
const fsp = require("fs/promises");
const http = require("http");
const path = require("path");
const { Pool } = require("pg");

const ROOT = __dirname;
const FRONTEND_ROOT = path.resolve(ROOT, "..", "frontend");

loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const RETURNING_EPI = `
  id::text,
  name,
  ca,
  category,
  lot,
  to_char(valid_until, 'YYYY-MM-DD') AS "validUntil",
  total_stock AS "totalStock",
  in_use AS "inUse",
  min_stock AS "minStock",
  department,
  supplier,
  notes
`;

const pool = new Pool(getDatabaseConfig());

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/epis")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Erro interno do servidor." });
  }
});

server.listen(PORT, () => {
  console.log(`Controle de EPI rodando em http://localhost:${PORT}`);
});

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "controle_epi",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || ""
  };
}

function loadEnvFile() {
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
    const { rows } = await pool.query(`
      SELECT ${RETURNING_EPI}
      FROM epis
      ORDER BY valid_until ASC, created_at DESC
    `);
    sendJson(response, 200, rows);
    return;
  }

  if (url.pathname === "/api/epis" && request.method === "POST") {
    const payload = await readJsonBody(request);
    const { data, errors } = validateEpi(payload);

    if (errors.length) {
      sendJson(response, 400, { error: errors.join(" ") });
      return;
    }

    const { rows } = await pool.query(
      `
        INSERT INTO epis (
          name, ca, category, lot, valid_until, total_stock,
          in_use, min_stock, department, supplier, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING ${RETURNING_EPI}
      `,
      valuesForEpi(data)
    );
    sendJson(response, 201, rows[0]);
    return;
  }

  if (idMatch && request.method === "PUT") {
    const payload = await readJsonBody(request);
    const { data, errors } = validateEpi(payload);

    if (errors.length) {
      sendJson(response, 400, { error: errors.join(" ") });
      return;
    }

    const { rows } = await pool.query(
      `
        UPDATE epis
        SET
          name = $1,
          ca = $2,
          category = $3,
          lot = $4,
          valid_until = $5,
          total_stock = $6,
          in_use = $7,
          min_stock = $8,
          department = $9,
          supplier = $10,
          notes = $11,
          updated_at = now()
        WHERE id = $12
        RETURNING ${RETURNING_EPI}
      `,
      [...valuesForEpi(data), idMatch[1]]
    );

    if (!rows.length) {
      sendJson(response, 404, { error: "EPI nao encontrado." });
      return;
    }

    sendJson(response, 200, rows[0]);
    return;
  }

  if (idMatch && request.method === "DELETE") {
    const result = await pool.query("DELETE FROM epis WHERE id = $1", [idMatch[1]]);

    if (!result.rowCount) {
      sendJson(response, 404, { error: "EPI nao encontrado." });
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Rota nao encontrada." });
}

async function serveStatic(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Metodo nao permitido." });
    return;
  }

  const staticFiles = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/script.js": "script.js"
  };
  const fileName = staticFiles[url.pathname];

  if (!fileName) {
    sendJson(response, 404, { error: "Arquivo nao encontrado." });
    return;
  }

  const filePath = path.join(FRONTEND_ROOT, fileName);
  const content = await fsp.readFile(filePath);
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

function validateEpi(payload) {
  const data = {
    name: stringValue(payload.name),
    ca: stringValue(payload.ca),
    category: stringValue(payload.category),
    lot: stringValue(payload.lot),
    validUntil: stringValue(payload.validUntil),
    totalStock: numberValue(payload.totalStock),
    inUse: numberValue(payload.inUse),
    minStock: numberValue(payload.minStock),
    department: stringValue(payload.department),
    supplier: stringValue(payload.supplier),
    notes: stringValue(payload.notes)
  };
  const errors = [];

  ["name", "ca", "category", "lot", "validUntil", "department", "supplier"].forEach((field) => {
    if (!data[field]) {
      errors.push("Preencha todos os campos obrigatorios.");
    }
  });

  ["totalStock", "inUse", "minStock"].forEach((field) => {
    if (!Number.isInteger(data[field]) || data[field] < 0) {
      errors.push("Estoque, em uso e minimo devem ser numeros inteiros positivos.");
    }
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.validUntil)) {
    errors.push("A validade deve estar no formato YYYY-MM-DD.");
  }

  if (Number.isInteger(data.totalStock) && Number.isInteger(data.inUse) && data.inUse > data.totalStock) {
    errors.push("Em uso nao pode ser maior que o estoque total.");
  }

  return { data, errors: [...new Set(errors)] };
}

function valuesForEpi(data) {
  return [
    data.name,
    data.ca,
    data.category,
    data.lot,
    data.validUntil,
    data.totalStock,
    data.inUse,
    data.minStock,
    data.department,
    data.supplier,
    data.notes
  ];
}

function stringValue(value) {
  return String(value ?? "").trim();
}

function numberValue(value) {
  if (value === "" || value === null || value === undefined) {
    return NaN;
  }

  return Number(value);
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

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function contentTypeFor(fileName) {
  const extension = path.extname(fileName);

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }

  return "text/html; charset=utf-8";
}
