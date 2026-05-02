import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;

const getDatabaseUrl = (): string => {
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

export const getPostgresPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return pool;
};

export const queryPostgres = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) => getPostgresPool().query<T>(text, params);

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
  options: { isolationLevel?: "serializable" } = {},
): Promise<T> => {
  const client = await getPostgresPool().connect();

  try {
    await client.query(
      options.isolationLevel === "serializable"
        ? "BEGIN ISOLATION LEVEL SERIALIZABLE"
        : "BEGIN",
    );
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
