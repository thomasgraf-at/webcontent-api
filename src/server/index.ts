import {
  WebFetcher,
  parseHtmlMeta,
  extractWithScope,
  FunctionScopeError,
  type ContentFormat,
  type PageMeta,
  type StoredPage,
  type Scope,
  validateScope,
} from "../services";
import {
  parseDataParam,
  runPlugins,
  type DataRequest,
  type DataResponse,
} from "../plugins";
import { DatabaseService, type PageData } from "../services";
import { parseTtl, DEFAULT_TTL, logServerRequest } from "../utils";

const PORT = parseInt(process.env.PORT || "233");

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
  cached?: boolean;
}

interface ApiOutput {
  request: ApiRequest;
  result: ApiResult_Result;
  debug?: DebugInfo;
}

interface FetchRequestOptions {
  scope?: Scope;
  format?: ContentFormat;
  data?: string | DataRequest;
  debug?: boolean;
  store?: boolean | { ttl?: string | number; client?: string };
}

interface FetchRequest {
  url: string;
  options?: FetchRequestOptions;
  include?: string | ResponseFields;
  debug?: boolean;
}

interface StoreRequest {
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

interface GetByIdRequest {
  id: string;
  client?: string;
}

interface GetsByIdsRequest {
  ids: string[];
  client?: string;
}

interface PageResponse {
  request: { id: string };
  response: {
    id: string;
    timestamp: number;
    url: string;
    status: number;
    meta?: any;
    content?: string;
    data?: any;
    options?: any;
    cached: boolean;
  };
}

interface PagesResponse {
  count: number;
  results: {
    id: string;
    url: string;
    title?: string;
    domain: string;
    hostname: string;
    timestamp: number;
    status: number;
    meta?: any;
    content?: string;
    data?: any;
    options?: any;
  }[];
}

function parseIncludeFields(include?: string | ResponseFields): ResponseFields {
  const defaults: ResponseFields = {
    headers: false,
    body: false,
    meta: true,
    content: true,
  };

  if (!include) return defaults;

  if (typeof include === "object") {
    return {
      headers: !!include.headers,
      body: !!include.body,
      meta: !!include.meta,
      content: !!include.content,
    };
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function storedPageToResponse(page: StoredPage): PageResponse["response"] {
  return {
    id: page.id,
    timestamp: page.timestamp,
    url: page.url,
    status: page.status,
    meta: page.meta,
    content: page.content || undefined,
    data: page.data,
    options: page.options,
    cached: true,
  };
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok" });
    }

    const db = new DatabaseService();

    // GET /pages/:id - Get single page by ID
    const pagesIdMatch = url.pathname.match(/^\/pages\/([a-zA-Z0-9_-]+)$/);
    if (pagesIdMatch && req.method === "GET") {
      try {
        await db.init();
        const id = pagesIdMatch[1];
        const client = url.searchParams.get("client") || undefined;

        const page = await db.getPageById(id, client);

        if (!page) {
          return jsonResponse({ error: "Page not found" }, 404);
        }

        const response: PageResponse = {
          request: { id },
          response: storedPageToResponse(page),
        };

        logServerRequest({
          timestamp: Date.now(),
          command: "GET /pages/:id",
          url: page.url,
          id: page.id,
          status: page.status,
        });

        return jsonResponse(response);
      } catch (error) {
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // POST /get - Get single page by ID (alternative)
    if (url.pathname === "/get" && req.method === "POST") {
      try {
        const body = await req.json() as GetByIdRequest;

        if (!body.id) {
          return jsonResponse({ error: "ID is required" }, 400);
        }

        await db.init();
        const page = await db.getPageById(body.id, body.client);

        if (!page) {
          return jsonResponse({ error: "Page not found" }, 404);
        }

        const response: PageResponse = {
          request: { id: body.id },
          response: storedPageToResponse(page),
        };

        logServerRequest({
          timestamp: Date.now(),
          command: "POST /get",
          url: page.url,
          id: page.id,
          status: page.status,
        });

        return jsonResponse(response);
      } catch (error) {
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // POST /gets - Get multiple pages by IDs
    if (url.pathname === "/gets" && req.method === "POST") {
      try {
        const body = await req.json() as GetsByIdsRequest;

        if (!body.ids || !Array.isArray(body.ids)) {
          return jsonResponse({ error: "IDs array is required" }, 400);
        }

        if (body.ids.length === 0) {
          return jsonResponse({ count: 0, results: [] });
        }

        if (body.ids.length > 100) {
          return jsonResponse({ error: "Maximum 100 IDs per request" }, 400);
        }

        await db.init();
        const pages = await db.getPagesByIds(body.ids, body.client);

        const response: PagesResponse = {
          count: pages.length,
          results: pages.map((page) => ({
            id: page.id,
            url: page.url,
            title: page.title || undefined,
            domain: page.domain,
            hostname: page.hostname,
            timestamp: page.timestamp,
            status: page.status,
            meta: page.meta,
            content: page.content || undefined,
            data: page.data,
            options: page.options,
          })),
        };

        logServerRequest({
          timestamp: Date.now(),
          command: "POST /gets",
          ids: body.ids,
          count: pages.length,
        });

        return jsonResponse(response);
      } catch (error) {
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // Fetch endpoint
    if (url.pathname === "/fetch" && req.method === "POST") {
      try {
        const body = await req.json() as FetchRequest;

        if (!body.url) {
          return jsonResponse({ error: "URL is required" }, 400);
        }

        if (!body.url.startsWith("http://") && !body.url.startsWith("https://")) {
          return jsonResponse({ error: "URL must start with http:// or https://" }, 400);
        }

        const opts = body.options || {};
        const format = opts.format || "markdown";
        const dataParam = opts.data;
        const storeParam = opts.store;
        const debugEnabled = body.debug || opts.debug || false;
        const includeFields = parseIncludeFields(body.include);

        let scope: Scope;
        try {
          scope = opts.scope ? validateScope(opts.scope) : "main";
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Invalid scope" },
            400
          );
        }

        if (!["html", "markdown", "text"].includes(format)) {
          return jsonResponse({ error: 'Format must be "html", "markdown", or "text"' }, 400);
        }

        let dataRequest: DataRequest | null = null;
        try {
          dataRequest = parseDataParam(dataParam);
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Invalid data parameter" },
            400
          );
        }

        const fetcher = new WebFetcher();
        const result = await fetcher.fetch(body.url);

        const apiRequestOptions: ApiRequestOptions = { scope, format };
        if (dataRequest) {
          apiRequestOptions.data = dataRequest;
        }

        const apiRequest: ApiRequest = {
          url: body.url,
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
        let scopeResolution: { scopeUsed: Scope; scopeResolved: boolean; handlerId?: string } | undefined;

        if (includeFields.headers) {
          apiOutput.result.headers = result.headers;
        }
        if (includeFields.body) {
          apiOutput.result.body = result.body;
        }
        if (includeFields.meta) {
          apiOutput.result.meta = parseHtmlMeta(result.body);
        }
        if (includeFields.content) {
          const extraction = await extractWithScope(result.body, scope, format, result.url);
          apiOutput.result.content = extraction.content;
          scopeResolution = extraction.scopeResolution;
        }
        if (dataRequest) {
          apiOutput.result.data = await runPlugins(result.body, dataRequest);
        }

        // Add debug info only if debug flag is set
        if (debugEnabled && scopeResolution) {
          apiOutput.debug = {
            scope: {
              requested: scope,
              used: scopeResolution.scopeUsed,
              resolved: scopeResolution.scopeResolved,
              ...(scopeResolution.handlerId && {
                handlerId: scopeResolution.handlerId,
              }),
            },
          };
        }

        // Database storage
        if (storeParam) {
          try {
            await db.init();

            const urlObj = new URL(result.url);
            const domainParts = urlObj.hostname.split(".");
            const domain = domainParts.slice(-2).join(".");

            const timestamp = Date.now();
            const storeOptions = typeof storeParam === "object" ? storeParam : {};
            const ttl = parseTtl(storeOptions.ttl) || DEFAULT_TTL;
            const deleteAt = timestamp + ttl * 1000;

            // Add store options to request for visibility
            apiRequest.options.store = {
              ttl: storeOptions.ttl,
              client: storeOptions.client,
            };

            const pageData: PageData = {
              url: result.url,
              domain: domain,
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              client: storeOptions.client || null,
              title: apiOutput.result.meta?.title || null,
              status: result.status,
              content: apiOutput.result.content || null,
              meta: apiOutput.result.meta || {},
              data: apiOutput.result.data || {},
              options: {
                scope,
                scopeUsed: scopeResolution?.scopeUsed,
                scopeResolved: scopeResolution?.scopeResolved,
                format,
              },
              timestamp,
              deleteAt,
            };

            const storedPage = await db.storePage(pageData);
            apiOutput.result.id = storedPage.id;
          } catch (dbError) {
            console.error(
              "Database Error:",
              dbError instanceof Error ? dbError.message : dbError
            );
          }
        }

        logServerRequest({
          timestamp: apiOutput.result.timestamp,
          command: "POST /fetch",
          url: result.url,
          id: apiOutput.result.id,
          status: result.status,
        });

        return jsonResponse(apiOutput);
      } catch (error) {
        // Return 400 for user errors (invalid function scope)
        if (error instanceof FunctionScopeError) {
          return jsonResponse({ error: error.message }, 400);
        }
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // POST /store endpoint
    if (url.pathname === "/store" && req.method === "POST") {
      try {
        const body = await req.json() as StoreRequest;

        if (!body.url) {
          return jsonResponse({ error: "URL is required" }, 400);
        }

        if (!body.url.startsWith("http://") && !body.url.startsWith("https://")) {
          return jsonResponse({ error: "URL must start with http:// or https://" }, 400);
        }

        // At least one of body, content, or data is required
        if (!body.body && !body.content && !body.data) {
          return jsonResponse({ error: "At least one of body, content, or data is required" }, 400);
        }

        await db.init();

        const urlObj = new URL(body.url);
        const domainParts = urlObj.hostname.split(".");
        const domain = domainParts.slice(-2).join(".");

        const timestamp = Date.now();
        const ttl = parseTtl(body.ttl) || DEFAULT_TTL;
        const deleteAt = timestamp + ttl * 1000;

        const pageData: PageData = {
          url: body.url,
          domain,
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          client: body.client || null,
          title: body.title || null,
          status: body.status || 200,
          content: body.content || body.body || null,
          meta: body.meta || {},
          data: body.data || {},
          options: body.options || {},
          timestamp,
          deleteAt,
        };

        const storedPage = await db.storePage(pageData);

        const result: StoreResult = {
          stored: true,
          id: storedPage.id,
          url: body.url,
          timestamp,
          deleteAt,
        };

        logServerRequest({
          timestamp,
          command: "POST /store",
          url: body.url,
          id: storedPage.id,
          status: pageData.status,
        });

        return jsonResponse(result);
      } catch (error) {
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // GET /fetch with query params
    if (url.pathname === "/fetch" && req.method === "GET") {
      const targetUrl = url.searchParams.get("url");

      if (!targetUrl) {
        return jsonResponse({ error: "URL is required" }, 400);
      }

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        return jsonResponse({ error: "URL must start with http:// or https://" }, 400);
      }

      const scopeParam = url.searchParams.get("scope") || "main";
      const format = (url.searchParams.get("format") || "markdown") as ContentFormat;
      const includeParam = url.searchParams.get("include") || undefined;
      const includeFields = parseIncludeFields(includeParam);
      const dataParam = url.searchParams.get("data") || undefined;
      const debugEnabled = url.searchParams.get("debug") === "true";

      let scope: Scope;
      try {
        // For GET requests, scope param can be simple string or JSON
        if (scopeParam.startsWith("{")) {
          scope = validateScope(JSON.parse(scopeParam));
        } else {
          scope = validateScope(scopeParam);
        }
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid scope" },
          400
        );
      }

      if (!["html", "markdown", "text"].includes(format)) {
        return jsonResponse({ error: 'Format must be "html", "markdown", or "text"' }, 400);
      }

      let dataRequest: DataRequest | null = null;
      try {
        dataRequest = parseDataParam(dataParam);
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Invalid data parameter" },
          400
        );
      }

      try {
        const fetcher = new WebFetcher();
        const result = await fetcher.fetch(targetUrl);

        const apiRequestOptions: ApiRequestOptions = { scope, format };
        if (dataRequest) {
          apiRequestOptions.data = dataRequest;
        }

        const apiRequest: ApiRequest = {
          url: targetUrl,
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
        let scopeResolution: { scopeUsed: Scope; scopeResolved: boolean; handlerId?: string } | undefined;

        if (includeFields.headers) {
          apiOutput.result.headers = result.headers;
        }
        if (includeFields.body) {
          apiOutput.result.body = result.body;
        }
        if (includeFields.meta) {
          apiOutput.result.meta = parseHtmlMeta(result.body);
        }
        if (includeFields.content) {
          const extraction = await extractWithScope(result.body, scope, format, result.url);
          apiOutput.result.content = extraction.content;
          scopeResolution = extraction.scopeResolution;
        }
        if (dataRequest) {
          apiOutput.result.data = await runPlugins(result.body, dataRequest);
        }

        // Add debug info only if debug flag is set
        if (debugEnabled && scopeResolution) {
          apiOutput.debug = {
            scope: {
              requested: scope,
              used: scopeResolution.scopeUsed,
              resolved: scopeResolution.scopeResolved,
              ...(scopeResolution.handlerId && {
                handlerId: scopeResolution.handlerId,
              }),
            },
          };
        }

        // Database storage (GET /fetch usually defaults to no store unless specified)
        const storeParam = url.searchParams.get("store");
        if (storeParam) {
          try {
            await db.init();

            const urlObj = new URL(result.url);
            const domainParts = urlObj.hostname.split(".");
            const domain = domainParts.slice(-2).join(".");

            const timestamp = Date.now();
            let ttl = DEFAULT_TTL;
            let client: string | null = null;

            if (storeParam.startsWith("{")) {
              try {
                const parsed = JSON.parse(storeParam);
                ttl = parseTtl(parsed.ttl) || ttl;
                client = parsed.client || null;
              } catch {
                // Ignore parse error
              }
            } else {
              ttl = parseTtl(storeParam) || ttl;
            }

            // Add store options to request for visibility
            client = client || url.searchParams.get("client") || null;
            apiRequest.options.store = {
              ttl: storeParam.startsWith("{") ? undefined : storeParam,
              client: client || undefined,
            };

            const pageData: PageData = {
              url: result.url,
              domain: domain,
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              client: client,
              title: apiOutput.result.meta?.title || null,
              status: result.status,
              content: apiOutput.result.content || null,
              meta: apiOutput.result.meta || {},
              data: apiOutput.result.data || {},
              options: {
                scope,
                scopeUsed: scopeResolution?.scopeUsed,
                scopeResolved: scopeResolution?.scopeResolved,
                format,
              },
              timestamp,
              deleteAt: timestamp + ttl * 1000,
            };

            const storedPage = await db.storePage(pageData);
            apiOutput.result.id = storedPage.id;
          } catch (dbError) {
            console.error(
              "Database Error:",
              dbError instanceof Error ? dbError.message : dbError
            );
          }
        }

        logServerRequest({
          timestamp: apiOutput.result.timestamp,
          command: "GET /fetch",
          url: result.url,
          id: apiOutput.result.id,
          status: result.status,
        });

        return jsonResponse(apiOutput);
      } catch (error) {
        // Return 400 for user errors (invalid function scope)
        if (error instanceof FunctionScopeError) {
          return jsonResponse({ error: error.message }, 400);
        }
        console.error("Error:", error);
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Internal server error" },
          500
        );
      }
    }

    // Not found
    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`WebContent server running on http://localhost:${server.port}`);
