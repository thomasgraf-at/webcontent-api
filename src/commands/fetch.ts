import { parseArgs } from "util";
import {
  WebFetcher,
  parseHtmlMeta,
  extractWithScope,
  type ContentFormat,
  type PageMeta,
  type Scope,
  type ScopeResolution,
  parseScopeArg,
  scopeToString,
} from "../services";
import {
  parseDataParam,
  runPlugins,
  type DataRequest,
  type DataResponse,
} from "../plugins";
import { DatabaseService, type PageData } from "../services";
import { parseTtl, DEFAULT_TTL, logRequest } from "../utils";

interface FetchOptions {
  url: string;
  scope: Scope;
  format: ContentFormat;
  output?: string;
  include: ResponseFields;
  data: DataRequest | null;
  debug: boolean;
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

interface ApiRequestOptions {
  scope: Scope;
  format: ContentFormat;
  data?: DataRequest;
  store?: {
    ttl?: string | number;
    client?: string;
  };
}

interface ApiRequest {
  url: string;
  options: ApiRequestOptions;
}

interface DebugInfo {
  scope?: {
    requested: Scope;
    used: Scope;
    resolved: boolean;
    handlerId?: string;
  };
}

interface ApiResult_Result {
  id?: string;
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

interface ApiOutput {
  request: ApiRequest;
  result: ApiResult_Result;
  debug?: DebugInfo;
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
      exclude: {
        type: "string",
        short: "x",
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
      debug: {
        type: "boolean",
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

  let scope: Scope;
  try {
    scope = parseScopeArg(values.scope || "main", values.exclude);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
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
    debug: !!values.debug,
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

    const apiRequestOptions: ApiRequestOptions = {
      scope: options.scope,
      format: options.format,
    };

    if (options.data) {
      apiRequestOptions.data = options.data;
    }

    const apiRequest: ApiRequest = {
      url: options.url,
      options: apiRequestOptions,
    };

    const apiOutput: ApiOutput = {
      request: apiRequest,
      result: {
        timestamp: Date.now(),
        url: result.url,
        status: result.status,
        redirect: result.redirect,
      },
    };

    // Track scope resolution for debug and storage
    let scopeResolution: ScopeResolution | undefined;

    // Include optional fields based on include settings
    if (options.include.headers) {
      apiOutput.result.headers = result.headers;
    }

    if (options.include.body) {
      apiOutput.result.body = result.body;
    }

    if (options.include.meta) {
      apiOutput.result.meta = parseHtmlMeta(result.body);
    }

    if (options.include.content) {
      const extraction = await extractWithScope(
        result.body,
        options.scope,
        options.format,
        result.url
      );
      apiOutput.result.content = extraction.content;
      scopeResolution = extraction.scopeResolution;
    }

    // Add debug info only if --debug flag is set
    if (options.debug && scopeResolution) {
      apiOutput.debug = {
        scope: {
          requested: options.scope,
          used: scopeResolution.scopeUsed,
          resolved: scopeResolution.scopeResolved,
          ...(scopeResolution.handlerId && {
            handlerId: scopeResolution.handlerId,
          }),
        },
      };
    }

    // Run data plugins
    if (options.data) {
      apiOutput.result.data = await runPlugins(result.body, options.data);
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

        // Add store options to request for visibility
        apiRequest.options.store = {
          ttl: options.store.ttl,
          client: options.store.client,
        };

        const pageData: PageData = {
          url: result.url,
          domain: domain,
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          client: options.store.client || null,
          title: apiOutput.result.meta?.title || null,
          status: result.status,
          content: apiOutput.result.content || null,
          meta: apiOutput.result.meta || {},
          data: apiOutput.result.data || {},
          options: {
            scope: options.scope,
            scopeUsed: scopeResolution?.scopeUsed,
            scopeResolved: scopeResolution?.scopeResolved,
            format: options.format,
          },
          timestamp,
          deleteAt,
        };

        const storedPage = await db.storePage(pageData);
        apiOutput.result.id = storedPage.id;
        console.error(`Successfully stored page in database (ID: ${storedPage.id})`);
      } catch (dbError) {
        console.error(
          "Database Error:",
          dbError instanceof Error ? dbError.message : dbError
        );
        // Don't exit here, still output the fetch result
      }
    }

    // Log the request
    logRequest({
      timestamp: apiOutput.result.timestamp,
      command: "fetch",
      url: result.url,
      id: apiOutput.result.id,
      status: result.status,
    });

    const outputText = JSON.stringify(apiOutput, null, 2);

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
  -s, --scope <type>      Content scope (default: main)
  -x, --exclude <sel>     CSS selectors to exclude (for selector scope)
  -f, --format <fmt>      Output format: html | markdown | text (default: markdown)
  -i, --include <fields>  Core response fields to include (default: meta,content)
  -d, --data <plugins>    Data plugins to run
  -o, --output <file>     Write output to file instead of stdout
  --store                 Store fetch result in database
  --ttl <duration>        TTL for stored record (default: 30d)
                          Formats: 60, 60min, 6h, 10d, 3mo, 1y
  --client <name>         Client/shard identifier for the stored record
  --debug                 Include debug info in response (scope resolution, etc.)
  -h, --help              Show this help message

Scope Types:
  main                    Extract main content using Readability (default)
  full                    Full page body
  auto                    Auto-detect based on site handlers
  selector:<sel>          CSS selector(s), comma-separated
  {...}                   JSON scope object (selector or function)

  Selector scope examples:
    selector:article
    selector:article,.content
    selector:#main --exclude .ads,.sidebar

  Function scope (JSON):
    {"type":"function","code":"(doc, url) => doc.getText('h1')"}

  Function scope API:
    doc.html            - Raw HTML string
    doc.getText(sel)    - Get text from matching tags
    doc.getInnerHTML(sel) - Get innerHTML of first match
    doc.getAllInnerHTML(sel) - Get all matches' innerHTML
    doc.getAttribute(sel, attr) - Get attribute value
    Selectors: tag names (h1, p), classes (.foo), IDs (#bar)

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
  webcontent fetch https://example.com -s auto
  webcontent fetch https://example.com -s 'selector:article,.post'
  webcontent fetch https://example.com -s 'selector:#content' -x '.ads,nav'
  webcontent fetch https://example.com -i "meta,content,headers"
  webcontent fetch https://example.com -d headings
  webcontent fetch https://example.com -d '{"headings":{"minLevel":2}}'
  webcontent fetch https://example.com -o result.json
  webcontent fetch https://example.com --store --ttl 7d
`);
}
