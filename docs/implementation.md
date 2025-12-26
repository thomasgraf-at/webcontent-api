# WebContent Implementation

## Architecture

### Project Structure

```
webcontent/
├── docs/
│   ├── specs.md           # Specifications and requirements
│   └── implementation.md  # This file
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

#### 5. Default Content Type: `main`

**What**: Content extraction defaults to `main` instead of `full`.

**Why**:
- Most use cases want the article/primary content, not navigation, footers, etc.
- Produces cleaner output for downstream processing
- Users can explicitly request `full` when needed

#### 6. Command Structure: fetch vs get (planned)

**What**: `fetch` always retrieves fresh content; `get` (planned) will check cache first.

**Why**:
- Clear separation of concerns
- `fetch` for when you need guaranteed fresh data
- `get` for efficiency when cached data is acceptable

#### 7. Port 233 for Local Development

**What**: Default server port is 233 for local development only.

**Why**: Memorable, uncommon port that doesn't conflict with common development ports (3000, 8080, etc.). Cloud deployments should use platform-standard port configuration.

### Key Libraries

| Library | Purpose |
|---------|---------|
| `node-html-parser` | Fast HTML parsing without DOM overhead |
| `turndown` | HTML to Markdown conversion |

### Content Extraction Logic

The `extractContent` function in `html-parser.ts`:

1. For `main` content: Looks for `<main>`, `<article>`, or elements with `role="main"`. Falls back to `<body>` if not found.
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

### Redirect Handling

When the target URL returns a 3xx status code:
- `statusCode`: Contains the redirect status (301, 302, 307, 308, etc.)
- `redirect`: Contains the value of the Location header
- `meta` and `content`: May be empty or partial depending on response body

Clients should check `statusCode` and `redirect` to determine if they need to make a follow-up request.

### Error Handling Strategy

1. **Validation errors** (400): Invalid URL format, invalid content/format values
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
