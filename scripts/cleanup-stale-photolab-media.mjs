import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { Pool } from "pg";

const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = new URL(supabaseUrl);
  const dbUser = process.env.POSTGRES_USER ?? "postgres";
  const dbPassword = process.env.POSTGRES_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD ?? "postgres";
  const dbName = process.env.POSTGRES_DB ?? "postgres";
  const dbPort = process.env.POSTGRES_PORT ?? (url.port === "54321" ? "54322" : "5432");

  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${url.hostname}:${dbPort}/${encodeURIComponent(dbName)}`;
};

const appRoot = process.env.APP_ROOT?.trim() || process.cwd();
const pool = new Pool({ connectionString: getDatabaseUrl() });

const fileExists = async (urlPath) => {
  const absolutePath = path.join(appRoot, "public", urlPath.replace(/^\/+/, ""));

  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
};

const result = await pool.query(`
  select
    mf.id,
    mf.filename,
    mf.url_path
  from exhibition.media_files mf
  where mf.usage_note like 'Photolab upload for %'
  and not exists (
    select 1
    from exhibition.product_images pi
    where pi.image_url = mf.url_path
       or pi.image_url like '%' || mf.url_path
  )
  order by mf.uploaded_at desc
`);

const staleRows = [];

for (const row of result.rows) {
  if (!(await fileExists(row.url_path))) {
    staleRows.push(row);
  }
}

if (staleRows.length === 0) {
  console.log("No stale Photolab media rows found.");
  await pool.end();
  process.exit(0);
}

const staleIds = staleRows.map((row) => row.id);
await pool.query("delete from exhibition.media_files where id = any($1::uuid[])", [staleIds]);

console.log(`Deleted ${staleRows.length} stale Photolab media rows:`);
for (const row of staleRows) {
  console.log(`- ${row.filename} (${row.url_path})`);
}

await pool.end();
