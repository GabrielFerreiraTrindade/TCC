// Roda um arquivo .sql contra o banco Postgres do Supabase, direto do terminal.
//
// Uso:
//   DATABASE_URL="postgresql://...connection string do Supabase..." node scripts/run-sql.mjs caminho/para/arquivo.sql
//
// A connection string fica em: painel do Supabase -> Settings -> Database -> Connection string
// (prefira a variante "Session pooler", compatível com redes só-IPv4).

import { readFileSync } from "node:fs";
import { Client } from "pg";

const [, , sqlPath] = process.argv;

if (!sqlPath) {
  console.error("Uso: node scripts/run-sql.mjs <arquivo.sql>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Defina a variável de ambiente DATABASE_URL com a connection string do Supabase antes de rodar este script.");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${sqlPath} aplicado com sucesso.`);
} catch (error) {
  console.error(`Falhou ao aplicar ${sqlPath}:`);
  console.error(error.message);
  process.exit(1);
} finally {
  await client.end();
}
