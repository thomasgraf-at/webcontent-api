import { parseArgs } from "util";
import {
  WebFetcher,
  parseHtmlMeta,
  extractContent,
  type ContentFormat,
  type PageMeta,
} from "../services";

interface FetchOptions {
  url: string;
  content: "full" | "main";
  format: ContentFormat;
  output?: string;
}

interface FetchResult {
  url: string;
  statusCode: number;
  redirect: string | null;
  timestamp: string;
  meta: PageMeta;
  content: string;
}

export async function fetchCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      content: {
        type: "string",
        short: "c",
        default: "main",
      },
      format: {
        type: "string",
        short: "f",
        default: "html",
      },
      output: {
        type: "string",
        short: "o",
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

  const options: FetchOptions = {
    url,
    content: (values.content as "full" | "main") || "main",
    format: (values.format as ContentFormat) || "html",
    output: values.output,
  };

  if (options.content !== "full" && options.content !== "main") {
    console.error('Error: Content must be "full" or "main"');
    process.exit(1);
  }

  if (!["html", "markdown", "text"].includes(options.format)) {
    console.error('Error: Format must be "html", "markdown", or "text"');
    process.exit(1);
  }

  await executeFetch(options);
}

async function executeFetch(options: FetchOptions): Promise<void> {
  const fetcher = new WebFetcher();

  try {
    const result = await fetcher.fetch(options.url);
    const meta = parseHtmlMeta(result.body);
    const content = extractContent(
      result.body,
      options.content === "main",
      options.format
    );

    const fetchResult: FetchResult = {
      url: result.url,
      statusCode: result.statusCode,
      redirect: result.redirect,
      timestamp: new Date().toISOString(),
      meta,
      content,
    };

    const outputText = JSON.stringify(fetchResult, null, 2);

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
  -c, --content <type>    Content type: full | main (default: main)
  -f, --format <fmt>      Output format: html | markdown | text (default: html)
  -o, --output <file>     Write output to file instead of stdout
  -h, --help              Show this help message

Examples:
  webcontent fetch https://example.com
  webcontent fetch https://example.com -c main -f markdown
  webcontent fetch https://example.com -o result.json
`);
}
