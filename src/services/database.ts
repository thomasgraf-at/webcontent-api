import { createClient, type Client } from "@libsql/client";
import { nanoid } from "nanoid";

export interface StoreOptions {
  ttl?: number;
  client?: string;
}

export interface PageData {
  id?: string;
  url: string;
  domain: string;
  hostname: string;
  path: string;
  title: string | null;
  status: number;
  content: string | null;
  meta: any;
  data: any;
  options: any;
  timestamp: number;
  deleteAt: number;
  client: string | null;
}

export interface StoredPage extends PageData {
  id: string;
}

export function generatePageId(): string {
  return nanoid(12);
}

export class DatabaseService {
  private client: Client;

  constructor(url?: string, authToken?: string) {
    let dbUrl = url || process.env.TURSO_URL;
    const dbToken = authToken || process.env.TURSO_AUTH_TOKEN;

    if (!dbUrl) {
      throw new Error("TURSO_URL environment variable is not set");
    }

    // Ensure protocol is present
    if (!dbUrl.includes("://") && !dbUrl.startsWith("file:")) {
      dbUrl = `libsql://${dbUrl}`;
    }

    this.client = createClient({
      url: dbUrl,
      authToken: dbToken,
    });
  }

  async init(): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        domain TEXT NOT NULL,
        hostname TEXT NOT NULL,
        path TEXT NOT NULL,
        client TEXT,
        title TEXT,
        status INTEGER NOT NULL,
        content TEXT,
        meta JSONB,
        data JSONB,
        options JSONB,
        timestamp INTEGER NOT NULL,
        deleteAt INTEGER NOT NULL
      );
    `);

    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_domain ON pages(domain);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_hostname ON pages(hostname);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(path);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title);`);
    await this.client.execute(`CREATE INDEX IF NOT EXISTS idx_pages_client ON pages(client);`);
  }

  async storePage(data: PageData): Promise<StoredPage> {
    const id = data.id || generatePageId();

    await this.client.execute({
      sql: `
        INSERT INTO pages (
          id, url, domain, hostname, path, client, title, status,
          content, meta, data, options, timestamp, deleteAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        data.url,
        data.domain,
        data.hostname,
        data.path,
        data.client,
        data.title,
        data.status,
        data.content,
        JSON.stringify(data.meta),
        JSON.stringify(data.data),
        JSON.stringify(data.options),
        data.timestamp,
        data.deleteAt,
      ],
    });

    return { ...data, id };
  }

  async getPageById(id: string, client?: string): Promise<StoredPage | null> {
    let sql = `SELECT * FROM pages WHERE id = ?`;
    const args: (string | null)[] = [id];

    // Client isolation: if client specified, must match
    if (client !== undefined) {
      sql += ` AND client = ?`;
      args.push(client);
    }

    const result = await this.client.execute({ sql, args });

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToStoredPage(result.rows[0]);
  }

  async getPagesByIds(ids: string[], client?: string): Promise<StoredPage[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = ids.map(() => "?").join(", ");
    let sql = `SELECT * FROM pages WHERE id IN (${placeholders})`;
    const args: (string | null)[] = [...ids];

    // Client isolation
    if (client !== undefined) {
      sql += ` AND client = ?`;
      args.push(client);
    }

    const result = await this.client.execute({ sql, args });

    // Convert rows to StoredPage objects
    const pages = result.rows.map((row) => this.rowToStoredPage(row));

    // Return in the same order as input IDs
    const pageMap = new Map(pages.map((p) => [p.id, p]));
    return ids.map((id) => pageMap.get(id)).filter((p): p is StoredPage => p !== undefined);
  }

  private rowToStoredPage(row: any): StoredPage {
    return {
      id: row.id as string,
      url: row.url as string,
      domain: row.domain as string,
      hostname: row.hostname as string,
      path: row.path as string,
      client: row.client as string | null,
      title: row.title as string | null,
      status: row.status as number,
      content: row.content as string | null,
      meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta,
      data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
      options: typeof row.options === "string" ? JSON.parse(row.options) : row.options,
      timestamp: row.timestamp as number,
      deleteAt: row.deleteAt as number,
    };
  }
}
