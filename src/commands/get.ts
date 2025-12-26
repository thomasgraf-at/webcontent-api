import { parseArgs } from "util";
import { DatabaseService, type StoredPage } from "../services";

interface GetOptions {
  id: string;
  client?: string;
  output?: string;
}

interface GetsOptions {
  ids: string[];
  client?: string;
  output?: string;
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

export async function getCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      id: {
        type: "string",
      },
      client: {
        type: "string",
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
    allowPositionals: false,
  });

  if (values.help) {
    showGetHelp();
    return;
  }

  if (!values.id) {
    console.error("Error: --id is required");
    showGetHelp();
    process.exit(1);
  }

  const options: GetOptions = {
    id: values.id,
    client: values.client,
    output: values.output,
  };

  await executeGet(options);
}

async function executeGet(options: GetOptions): Promise<void> {
  try {
    const db = new DatabaseService();
    await db.init();

    const page = await db.getPageById(options.id, options.client);

    if (!page) {
      console.error(`Error: Page not found with ID: ${options.id}`);
      process.exit(1);
    }

    const response: PageResponse = {
      request: { id: options.id },
      response: storedPageToResponse(page),
    };

    const outputText = JSON.stringify(response, null, 2);

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

export async function getsCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      ids: {
        type: "string",
      },
      client: {
        type: "string",
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
    allowPositionals: false,
  });

  if (values.help) {
    showGetsHelp();
    return;
  }

  if (!values.ids) {
    console.error("Error: --ids is required");
    showGetsHelp();
    process.exit(1);
  }

  const ids = values.ids.split(",").map((id) => id.trim()).filter(Boolean);

  if (ids.length === 0) {
    console.error("Error: At least one ID is required");
    process.exit(1);
  }

  if (ids.length > 100) {
    console.error("Error: Maximum 100 IDs per request");
    process.exit(1);
  }

  const options: GetsOptions = {
    ids,
    client: values.client,
    output: values.output,
  };

  await executeGets(options);
}

async function executeGets(options: GetsOptions): Promise<void> {
  try {
    const db = new DatabaseService();
    await db.init();

    const pages = await db.getPagesByIds(options.ids, options.client);

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

    const outputText = JSON.stringify(response, null, 2);

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

function showGetHelp(): void {
  console.log(`
webcontent get - Get a stored page by ID

Usage:
  webcontent get --id <page-id> [options]

Options:
  --id <id>          Page ID to retrieve (required)
  --client <name>    Client/shard identifier (for isolation)
  -o, --output <file>  Write output to file instead of stdout
  -h, --help         Show this help message

Examples:
  webcontent get --id abc123def456
  webcontent get --id abc123def456 --client my-app
  webcontent get --id abc123def456 -o page.json
`);
}

function showGetsHelp(): void {
  console.log(`
webcontent gets - Get multiple stored pages by IDs

Usage:
  webcontent gets --ids <id1,id2,...> [options]

Options:
  --ids <ids>        Comma-separated page IDs to retrieve (required, max 100)
  --client <name>    Client/shard identifier (for isolation)
  -o, --output <file>  Write output to file instead of stdout
  -h, --help         Show this help message

Examples:
  webcontent gets --ids abc123,def456,ghi789
  webcontent gets --ids abc123,def456 --client my-app
  webcontent gets --ids abc123,def456 -o pages.json
`);
}
