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

const PORT = parseInt(process.env.PORT || "233");

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

interface FetchRequest {
  url: string;
  scope?: "full" | "main";
  format?: ContentFormat;
  include?: string | ResponseFields;
  data?: string | DataRequest;
  store?: boolean | { ttl?: number; client?: string };
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

const server = Bun.serve({
  port: PORT,
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

        const scope = body.scope || "main";
        const format = body.format || "markdown";
        const includeFields = parseIncludeFields(body.include);

        if (scope !== "full" && scope !== "main") {
          return jsonResponse({ error: 'Scope must be "full" or "main"' }, 400);
        }

        if (!["html", "markdown", "text"].includes(format)) {
          return jsonResponse({ error: 'Format must be "html", "markdown", or "text"' }, 400);
        }

        let dataRequest: DataRequest | null = null;
        try {
          dataRequest = parseDataParam(body.data);
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "Invalid data parameter" },
            400
          );
        }

        const fetcher = new WebFetcher();
        const result = await fetcher.fetch(body.url);

        const apiRequest: ApiRequest = {
          url: body.url,
          options: { scope, format },
        };

        if (dataRequest) {
          apiRequest.data = dataRequest;
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

        if (includeFields.headers) {
          apiResult.response.headers = result.headers;
        }
        if (includeFields.body) {
          apiResult.response.body = result.body;
        }
        if (includeFields.meta) {
          apiResult.response.meta = parseHtmlMeta(result.body);
        }
        if (includeFields.content) {
          apiResult.response.content = extractContent(result.body, scope === "main", format);
        }
        if (dataRequest) {
          apiResult.response.data = await runPlugins(result.body, dataRequest);
        }

        // Database storage
        if (body.store) {
          try {
            await db.init();

            const urlObj = new URL(result.url);
            const domainParts = urlObj.hostname.split(".");
            const domain = domainParts.slice(-2).join(".");

            const timestamp = Date.now();
            const storeOptions = typeof body.store === "object" ? body.store : {};
            const ttl = storeOptions.ttl || 30 * 24 * 60 * 60;
            const deleteAt = timestamp + ttl * 1000;

            const pageData: PageData = {
              url: result.url,
              domain: domain,
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              client: storeOptions.client || null,
              title: apiResult.response.meta?.title || null,
              status: result.status,
              content: apiResult.response.content || null,
              meta: apiResult.response.meta || {},
              data: apiResult.response.data || {},
              options: {
                scope,
                format,
              },
              timestamp,
              deleteAt,
            };

            await db.storePage(pageData);
          } catch (dbError) {
            console.error(
              "Database Error:",
              dbError instanceof Error ? dbError.message : dbError
            );
          }
        }

        return jsonResponse(apiResult);
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

      const scope = (url.searchParams.get("scope") || "main") as "full" | "main";
      const format = (url.searchParams.get("format") || "markdown") as ContentFormat;
      const includeParam = url.searchParams.get("include") || undefined;
      const includeFields = parseIncludeFields(includeParam);
      const dataParam = url.searchParams.get("data") || undefined;

      if (scope !== "full" && scope !== "main") {
        return jsonResponse({ error: 'Scope must be "full" or "main"' }, 400);
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

        const apiRequest: ApiRequest = {
          url: targetUrl,
          options: { scope, format },
        };

        if (dataRequest) {
          apiRequest.data = dataRequest;
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

        if (includeFields.headers) {
          apiResult.response.headers = result.headers;
        }
        if (includeFields.body) {
          apiResult.response.body = result.body;
        }
        if (includeFields.meta) {
          apiResult.response.meta = parseHtmlMeta(result.body);
        }
        if (includeFields.content) {
          apiResult.response.content = extractContent(result.body, scope === "main", format);
        }
        if (dataRequest) {
          apiResult.response.data = await runPlugins(result.body, dataRequest);
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
            let ttl = 30 * 24 * 60 * 60;
            let client: string | null = null;

            if (storeParam.startsWith("{")) {
              try {
                const parsed = JSON.parse(storeParam);
                ttl = parsed.ttl || ttl;
                client = parsed.client || null;
              } catch {
                // Ignore parse error
              }
            } else if (!isNaN(Number(storeParam))) {
              ttl = Number(storeParam);
            }

            const pageData: PageData = {
              url: result.url,
              domain: domain,
              hostname: urlObj.hostname,
              path: urlObj.pathname,
              client: client || url.searchParams.get("client") || null,
              title: apiResult.response.meta?.title || null,
              status: result.status,
              content: apiResult.response.content || null,
              meta: apiResult.response.meta || {},
              data: apiResult.response.data || {},
              options: {
                scope,
                format,
              },
              timestamp,
              deleteAt: timestamp + ttl * 1000,
            };

            await db.storePage(pageData);
          } catch (dbError) {
            console.error(
              "Database Error:",
              dbError instanceof Error ? dbError.message : dbError
            );
          }
        }

        return jsonResponse(apiResult);
      } catch (error) {
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
