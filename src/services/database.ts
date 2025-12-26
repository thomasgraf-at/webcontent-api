import { createClient, type Client } from "@libsql/client";

export interface StoreOptions {
  ttl?: number;
  client?: string;
}

export interface PageData {
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  async storePage(data: PageData): Promise<void> {
    await this.client.execute({
      sql: `
        INSERT INTO pages (
          url, domain, hostname, path, client, title, status, 
          content, meta, data, options, timestamp, deleteAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
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
  }
}
