import { parseArgs } from "util";
import {
  WebFetcher,
  parseHtmlMeta,
  extractContent,
  type ContentFormat,
  type PageMeta,
} from "../services";
import {
  parseDataParam,
  runPlugins,
  type DataRequest,
  type DataResponse,
} from "../plugins";
import { DatabaseService, type PageData } from "../services";
import { parseTtl, DEFAULT_TTL } from "../utils";

interface FetchOptions {
  url: string;
  scope: "full" | "main";
  format: ContentFormat;
  output?: string;
  include: ResponseFields;
  data: DataRequest | null;
  store: {
    enabled: boolean;
    ttl?: number;
    client?: string;
  };
}

interface ResponseFields {
  headers: boolean;
  body: boolean;
  meta: boolean;
  content: boolean;
}

interface ApiRequest {
  url: string;
  options: {
    scope: "full" | "main";
    format: ContentFormat;
  };
  data?: DataRequest;
}

interface ApiResponse {
  timestamp: number;
  url: string;
  status: number;
  redirect: string | null;
  headers?: Record<string, string>;
  body?: string;
  meta?: PageMeta;
  content?: string;
  data?: DataResponse;
}

interface ApiResult {
  request: ApiRequest;
  response: ApiResponse;
}

function parseIncludeFields(include?: string): ResponseFields {
  // Default: meta and content
  const defaults: ResponseFields = {
    headers: false,
    body: false,
    meta: true,
    content: true,
  };

  if (!include) return defaults;

  // Parse comma-separated string or JSON object
  if (include.startsWith("{")) {
    try {
      const parsed = JSON.parse(include);
      return {
        headers: !!parsed.headers,
        body: !!parsed.body,
        meta: !!parsed.meta,
        content: !!parsed.content,
      };
    } catch {
      return defaults;
    }
  }

  // Comma-separated format
  const fields = include.toLowerCase().split(",").map((s) => s.trim());
  return {
    headers: fields.includes("headers"),
    body: fields.includes("body"),
    meta: fields.includes("meta"),
    content: fields.includes("content"),
  };
}

export async function fetchCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      scope: {
        type: "string",
        short: "s",
        default: "main",
      },
      format: {
        type: "string",
        short: "f",
        default: "markdown",
      },
      include: {
        type: "string",
        short: "i",
      },
      data: {
        type: "string",
        short: "d",
      },
      output: {
        type: "string",
        short: "o",
      },
      store: {
        type: "boolean",
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
    showFetchHelp();
    return;
  }

  const url = positionals[0];

  if (!url) {
    console.error("Error: URL is required");
    showFetchHelp();
    process.exit(1);
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.error("Error: URL must start with http:// or https://");
    process.exit(1);
  }

  const scope = (values.scope as "full" | "main") || "main";
  if (scope !== "full" && scope !== "main") {
    console.error('Error: Scope must be "full" or "main"');
    process.exit(1);
  }

  const format = (values.format as ContentFormat) || "markdown";
  if (!["html", "markdown", "text"].includes(format)) {
    console.error('Error: Format must be "html", "markdown", or "text"');
    process.exit(1);
  }

  let dataRequest: DataRequest | null = null;
  try {
    dataRequest = parseDataParam(values.data);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const storeEnabled = !!values.store;
  const storeTtl = parseTtl(values.ttl);

  const options: FetchOptions = {
    url,
    scope,
    format,
    output: values.output,
    include: parseIncludeFields(values.include),
    data: dataRequest,
    store: {
      enabled: storeEnabled,
      ttl: storeTtl,
      client: values.client,
    },
  };

  await executeFetch(options);
}

async function executeFetch(options: FetchOptions): Promise<void> {
  const fetcher = new WebFetcher();

  try {
    const result = await fetcher.fetch(options.url);

    const apiRequest: ApiRequest = {
      url: options.url,
      options: {
        scope: options.scope,
        format: options.format,
      },
    };

    if (options.data) {
      apiRequest.data = options.data;
    }

    const apiResult: ApiResult = {
      request: apiRequest,
      response: {
        timestamp: Date.now(),
        url: result.url,
        status: result.status,
        redirect: result.redirect,
      },
    };

    // Include optional fields based on include settings
    if (options.include.headers) {
      apiResult.response.headers = result.headers;
    }

    if (options.include.body) {
      apiResult.response.body = result.body;
    }

    if (options.include.meta) {
      apiResult.response.meta = parseHtmlMeta(result.body);
    }

    if (options.include.content) {
      apiResult.response.content = extractContent(
        result.body,
        options.scope === "main",
        options.format
      );
    }

    // Run data plugins
    if (options.data) {
      apiResult.response.data = await runPlugins(result.body, options.data);
    }

    // Database storage
    if (options.store.enabled) {
      try {
        const db = new DatabaseService();
        await db.init();

        const urlObj = new URL(result.url);
        const domainParts = urlObj.hostname.split(".");
        const domain = domainParts.slice(-2).join("."); // Basic domain extraction

        const timestamp = Date.now();
        const ttl = options.store.ttl || DEFAULT_TTL;
        const deleteAt = timestamp + ttl * 1000;

        const pageData: PageData = {
          url: result.url,
          domain: domain,
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          client: options.store.client || null,
          title: apiResult.response.meta?.title || null,
          status: result.status,
          content: apiResult.response.content || null,
          meta: apiResult.response.meta || {},
          data: apiResult.response.data || {},
          options: {
            scope: options.scope,
            format: options.format,
          },
          timestamp,
          deleteAt,
        };

        await db.storePage(pageData);
        console.error("Successfully stored page in database");
      } catch (dbError) {
        console.error(
          "Database Error:",
          dbError instanceof Error ? dbError.message : dbError
        );
        // Don't exit here, still output the fetch result
      }
    }

    const outputText = JSON.stringify(apiResult, null, 2);

    // Write to file or stdout
    if (options.output) {
      await Bun.write(options.output, outputText);
      console.error(`Output written to ${options.output}`);
    } else {
      console.log(outputText);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function showFetchHelp(): void {
  console.log(`
webcontent fetch - Fetch a web page (always fresh, bypasses cache)

Usage:
  webcontent fetch <url> [options]

Options:
  -s, --scope <type>      Content scope: full | main (default: main)
  -f, --format <fmt>      Output format: html | markdown | text (default: markdown)
  -i, --include <fields>  Core response fields to include (default: meta,content)
  -d, --data <plugins>    Data plugins to run
  -o, --output <file>     Write output to file instead of stdout
  --store                 Store fetch result in database
  --ttl <duration>        TTL for stored record (default: 30d)
                          Formats: 60, 60min, 6h, 10d, 3mo, 1y
  --client <name>         Client/shard identifier for the stored record
  -h, --help              Show this help message

Include Fields:
  meta      Page metadata (title, description, opengraph, etc.)
  content   Extracted content in requested format
  headers   Raw HTTP response headers
  body      Raw HTML body

Data Plugins:
  headings  Extract heading hierarchy (h1-h6)
  links     Extract internal/external links (planned)
  images    Extract image URLs and alt text (planned)

Examples:
  webcontent fetch https://example.com
  webcontent fetch https://example.com -s main -f markdown
  webcontent fetch https://example.com -i "meta,content,headers"
  webcontent fetch https://example.com -d headings
  webcontent fetch https://example.com -d '{"headings":{"minLevel":2}}'
  webcontent fetch https://example.com -o result.json
  webcontent fetch https://example.com --store --ttl 7d
`);
}
