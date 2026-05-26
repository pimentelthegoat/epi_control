const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const ROOT = path.resolve(__dirname, "..");

loadEnvFile();

const targetDatabase = process.env.PGDATABASE || "controle_epi";

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  if (process.env.DATABASE_URL) {
    await applySchema({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false
    });
    return;
  }

  const baseConfig = {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || ""
  };
  const adminPool = new Pool({
    ...baseConfig,
    database: process.env.PGMAINTENANCE_DB || "postgres"
  });

  try {
    const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDatabase]);

    if (!exists.rowCount) {
      await adminPool.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
      console.log(`Banco ${targetDatabase} criado.`);
    }
  } finally {
    await adminPool.end();
  }

  await applySchema({
    ...baseConfig,
    database: targetDatabase
  });
}

async function applySchema(config) {
  const pool = new Pool(config);
  const schemaPath = path.join(ROOT, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  try {
    await pool.query(schema);
    console.log("Schema aplicado com sucesso.");
  } finally {
    await pool.end();
  }
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

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}
