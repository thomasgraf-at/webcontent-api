import { parseArgs } from "util";
import { DatabaseService, type PageData } from "../services";
import { parseTtl, DEFAULT_TTL, logRequest } from "../utils";

interface StoreInput {
  url: string;
  status?: number;
  title?: string;
  content?: string;
  body?: string;
  meta?: Record<string, unknown>;
  data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  ttl?: string | number;
  client?: string;
}

interface StoreResult {
  stored: boolean;
  id: string;
  url: string;
  timestamp: number;
  deleteAt: number;
}

export async function storeCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      status: {
        type: "string",
      },
      title: {
        type: "string",
      },
      content: {
        type: "string",
      },
      body: {
        type: "string",
      },
      meta: {
        type: "string",
      },
      data: {
        type: "string",
      },
      options: {
        type: "string",
      },
      ttl: {
        type: "string",
      },
      client: {
        type: "string",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    allowPositionals: true,
  });

  if (values.help) {
    showStoreHelp();
    return;
  }

  const url = positionals[0];

  if (!url) {
    console.error("Error: URL is required");
    showStoreHelp();
    process.exit(1);
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.error("Error: URL must start with http:// or https://");
    process.exit(1);
  }

  // Validate: at least one of body, content, or data must be provided
  if (!values.body && !values.content && !values.data) {
    console.error("Error: At least one of --body, --content, or --data is required");
    process.exit(1);
  }

  // Parse JSON fields
  let meta: Record<string, unknown> = {};
  let data: Record<string, unknown> = {};
  let options: Record<string, unknown> = {};

  if (values.meta) {
    try {
      meta = JSON.parse(values.meta);
    } catch {
      console.error("Error: --meta must be valid JSON");
      process.exit(1);
    }
  }

  if (values.data) {
    try {
      data = JSON.parse(values.data);
    } catch {
      console.error("Error: --data must be valid JSON");
      process.exit(1);
    }
  }

  if (values.options) {
    try {
      options = JSON.parse(values.options);
    } catch {
      console.error("Error: --options must be valid JSON");
      process.exit(1);
    }
  }

  const input: StoreInput = {
    url,
    status: values.status ? parseInt(values.status, 10) : undefined,
    title: values.title,
    content: values.content,
    body: values.body,
    meta,
    data,
    options,
    ttl: values.ttl,
    client: values.client,
  };

  await executeStore(input);
}

async function executeStore(input: StoreInput): Promise<void> {
  try {
    const db = new DatabaseService();
    await db.init();

    const urlObj = new URL(input.url);
    const domainParts = urlObj.hostname.split(".");
    const domain = domainParts.slice(-2).join(".");

    const timestamp = Date.now();
    const ttl = parseTtl(input.ttl) || DEFAULT_TTL;
    const deleteAt = timestamp + ttl * 1000;

    const pageData: PageData = {
      url: input.url,
      domain,
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      client: input.client || null,
      title: input.title || null,
      status: input.status || 200,
      content: input.content || input.body || null,
      meta: input.meta || {},
      data: input.data || {},
      options: input.options || {},
      timestamp,
      deleteAt,
    };

    const storedPage = await db.storePage(pageData);

    const result: StoreResult = {
      stored: true,
      id: storedPage.id,
      url: input.url,
      timestamp,
      deleteAt,
    };

    // Log the request
    logRequest({
      timestamp,
      command: "store",
      url: input.url,
      id: storedPage.id,
      status: pageData.status,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function showStoreHelp(): void {
  console.log(`
webcontent store - Store page data directly in database

Usage:
  webcontent store <url> [options]

Required:
  <url>                   URL for the record (must start with http:// or https://)
  At least one of: --body, --content, or --data

Options:
  --status <code>         HTTP status code (default: 200)
  --title <text>          Page title
  --content <text>        Extracted content
  --body <text>           Raw HTML body
  --meta <json>           Page metadata as JSON
  --data <json>           Plugin data as JSON
  --options <json>        Request options as JSON
  --ttl <duration>        TTL for stored record (default: 30d)
                          Formats: 60, 60min, 6h, 10d, 3mo, 1y
  --client <name>         Client/shard identifier
  -h, --help              Show this help message

Examples:
  webcontent store https://example.com --content "Page content here"
  webcontent store https://example.com --body "<html>...</html>" --title "Example"
  webcontent store https://example.com --data '{"headings":[{"level":1,"text":"Title"}]}'
  webcontent store https://example.com --content "Content" --ttl 7d --client "my-app"
`);
}
