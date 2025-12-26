# WebContent Implementation

## Architecture

### Project Structure

```
webcontent/
├── docs/
│   ├── specs.md           # Specifications and requirements
│   ├── implementation.md  # This file
│   └── proposals.md       # Future enhancements
├── src/
│   ├── cli.ts             # CLI entry point
│   ├── commands/
│   │   ├── index.ts       # Command exports
│   │   └── fetch.ts       # Fetch command implementation
│   ├── server/
│   │   └── index.ts       # HTTP server
│   └── services/
│       ├── index.ts       # Service exports
│       ├── web-fetcher.ts # HTTP fetching logic
│       └── html-parser.ts # HTML parsing and conversion
├── test.html              # Browser-based API test page
├── package.json
├── tsconfig.json
└── README.md
```

### Design Decisions

#### 1. Bun Runtime

**What**: Using Bun instead of Node.js or Deno.

**Why**:
- Native TypeScript support without compilation step
- Fast startup and execution
- Built-in `Bun.serve()` for HTTP server
- Can compile to standalone binary with `bun build --compile`

#### 2. Multimodal Interface (CLI + Server)

**What**: Same core functionality exposed via both CLI and HTTP server.

**Why**:
- CLI for scripting and automation
- HTTP server for integration with other services and browser-based tools
- Shared service layer reduces code duplication

#### 3. Service Layer Architecture

**What**: Separate services for fetching and parsing.

**Why**:
- Single responsibility principle
- Easy to test individual components
- Allows swapping implementations (e.g., different parsers)

#### 4. No Auto-Follow Redirects

**What**: The web fetcher does not automatically follow HTTP redirects.

**Why**:
- Gives clients visibility into redirect chains
- Allows clients to decide whether to follow redirects
- Important for SEO analysis and link checking use cases
- The `redirect` field contains the Location header value for 3xx responses

#### 5. Default Content Scope: `main`

**What**: Content extraction defaults to `main` instead of `full`.

**Why**:
- Most use cases want the article/primary content, not navigation, footers, etc.
- Produces cleaner output for downstream processing
- Users can explicitly request `full` when needed

#### 6. Default Format: `markdown`

**What**: Output format defaults to `markdown` instead of `html`.

**Why**:
- Markdown is more readable and compact
- Better for LLM consumption and text processing
- HTML available when structure is needed

#### 7. Command Structure: fetch vs get (planned)

**What**: `fetch` always retrieves fresh content; `get` (planned) will check cache first.

**Why**:
- Clear separation of concerns
- `fetch` for when you need guaranteed fresh data
- `get` for efficiency when cached data is acceptable

#### 8. Port 233 for Local Development

**What**: Default server port is 233 for local development only.

**Why**: Memorable, uncommon port that doesn't conflict with common development ports (3000, 8080, etc.). Cloud deployments should use platform-standard port configuration.

#### 9. Request/Response Envelope

**What**: All responses wrap data in a `{ request, response }` envelope.

**Why**:
- Clear separation between request echoing and response data
- Enables request tracking and debugging
- Consistent structure for all response types

#### 10. Selectable Response Fields

**What**: Clients specify which fields to include via `include` parameter.

**Why**:
- Reduces payload size when not all data is needed
- `headers` and `body` are large and rarely needed
- Default (`meta,content`) covers most use cases
- Supports both string (`"meta,content"`) and object (`{meta:true}`) formats

### Key Libraries

| Library | Purpose |
|---------|---------|
| `node-html-parser` | Fast HTML parsing without DOM overhead |
| `turndown` | HTML to Markdown conversion |

### Content Extraction Logic

The `extractContent` function in `html-parser.ts`:

1. For `main` scope: Looks for `<main>`, `<article>`, or elements with `role="main"`. Falls back to `<body>` if not found.
2. Removes noise: `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`.
3. Converts to requested format:
   - `html`: Returns cleaned HTML
   - `markdown`: Uses Turndown library
   - `text`: Strips all tags, normalizes whitespace

### Metadata Parsing

The `parseHtmlMeta` function extracts:

- **Basic**: title, description, keywords, canonical, robots
- **Indexability**: Parsed from robots meta tag
- **Heading**: First H1 element
- **Hreflang**: Language/region alternate URLs
- **Open Graph**: Social sharing metadata

### Response Structure

```typescript
interface ApiResult {
  request: {
    url: string;
    options: {
      scope: "full" | "main";
      format: "html" | "markdown" | "text";
    };
  };
  response: {
    timestamp: number;      // Unix ms - always included
    url: string;            // Always included
    status: number;         // Always included
    redirect: string | null; // Always included
    headers?: Record<string, string>;  // Optional
    body?: string;          // Optional
    meta?: PageMeta;        // Default included
    content?: string;       // Default included
    elements?: ResponseElements;  // Optional, not yet implemented
  };
}
```

### Redirect Handling

When the target URL returns a 3xx status code:
- `status`: Contains the redirect status (301, 302, 307, 308, etc.)
- `redirect`: Contains the value of the Location header
- `meta` and `content`: May be empty or partial depending on response body

Clients should check `status` and `redirect` to determine if they need to make a follow-up request.

### Error Handling Strategy

1. **Validation errors** (400): Invalid URL format, invalid scope/format values
2. **Fetch errors** (500): Network failures, target server errors

### Test Page

`test.html` provides browser-based testing:

- Form with all API options
- GET and POST request buttons
- Tabbed result display (Content, Overview, Metadata, Raw JSON)
- Detailed error display with hints
- CORS-enabled for local development

### Build and Distribution

```bash
# Development
bun run cli fetch <url>      # Run CLI
bun run server               # Run server

# Production
bun run build                # Compile CLI to binary
bun run build:server         # Compile server to binary
```

Compiled binaries are standalone and don't require Bun to be installed.
