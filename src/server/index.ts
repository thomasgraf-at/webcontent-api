import {
  WebFetcher,
  parseHtmlMeta,
  extractContent,
  type ContentFormat,
} from "../services";

const PORT = parseInt(process.env.PORT || "233");

interface FetchRequest {
  url: string;
  content?: "full" | "main";
  format?: ContentFormat;
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

        const contentType = body.content || "main";
        const format = body.format || "html";

        if (contentType !== "full" && contentType !== "main") {
          return jsonResponse({ error: 'Content must be "full" or "main"' }, 400);
        }

        if (!["html", "markdown", "text"].includes(format)) {
          return jsonResponse({ error: 'Format must be "html", "markdown", or "text"' }, 400);
        }

        const fetcher = new WebFetcher();
        const result = await fetcher.fetch(body.url);
        const meta = parseHtmlMeta(result.body);
        const content = extractContent(result.body, contentType === "main", format);

        const fetchResult = {
          url: result.url,
          statusCode: result.statusCode,
          redirect: result.redirect,
          timestamp: new Date().toISOString(),
          meta,
          content,
        };

        return jsonResponse(fetchResult);
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

      const contentType = (url.searchParams.get("content") || "main") as "full" | "main";
      const format = (url.searchParams.get("format") || "html") as ContentFormat;

      if (contentType !== "full" && contentType !== "main") {
        return jsonResponse({ error: 'Content must be "full" or "main"' }, 400);
      }

      if (!["html", "markdown", "text"].includes(format)) {
        return jsonResponse({ error: 'Format must be "html", "markdown", or "text"' }, 400);
      }

      try {
        const fetcher = new WebFetcher();
        const result = await fetcher.fetch(targetUrl);
        const meta = parseHtmlMeta(result.body);
        const content = extractContent(result.body, contentType === "main", format);

        const fetchResult = {
          url: result.url,
          statusCode: result.statusCode,
          redirect: result.redirect,
          timestamp: new Date().toISOString(),
          meta,
          content,
        };

        return jsonResponse(fetchResult);
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
