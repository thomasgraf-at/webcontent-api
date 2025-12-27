# WebContent Implementation

## Tech Stack

| Component   | Technology       | Purpose                                               |
|-------------|------------------|-------------------------------------------------------|
| Runtime     | Bun              | Native TypeScript, fast execution, binary compilation |
| Language    | TypeScript       | Type safety, better DX                                |
| HTML Parser | node-html-parser | Fast HTML parsing for extraction pipeline             |
| DOM Library | linkedom         | Full DOM compliance for handler functions             |
| Markdown    | Turndown         | HTML to Markdown conversion                           |
| Sandbox     | QuickJS (WASM)   | Secure JavaScript execution for handler functions    |
| Database    | Turso (libSQL)   | Optional storage of fetch results                     |

## Dependencies

```json
{
  "dependencies": {
    "@jitl/quickjs-ng-wasmfile-release-sync": "QuickJS WASM binary",
    "@libsql/client": "Turso database client",
    "@sebastianwessel/quickjs": "QuickJS wrapper for sandbox",
    "linkedom": "DOM implementation for handler functions",
    "nanoid": "ID generation for stored pages",
    "node-html-parser": "Fast HTML parsing",
    "turndown": "HTML to Markdown conversion"
  }
}
```

---

## Project Structure

```
webcontent/
├── docs/
│   ├── specs/                      # Hard requirements (binding)
│   │   ├── project-specs.md        # Product specification
│   │   ├── implementation-checklist.md
│   │   └── documentation-style.md
│   ├── implementation/             # Technical details
│   │   ├── changelog.md            # Feature changelog
│   │   ├── core.md                 # This file
│   │   ├── database.md             # Database schema and service
│   │   ├── scope.md                # Scope types and resolution
│   │   └── handler-apis.md         # Handler function API spec
│   ├── usage/                      # End-user guides
│   │   ├── cli.md                  # CLI usage guide
│   │   ├── api.md                  # HTTP API reference
│   │   ├── handler-functions.md    # Handler function guide
│   │   └── deploy.md               # Deployment guide
│   └── proposals/                  # Future plans (not binding)
│       ├── base.md                 # Roadmap
│       ├── command-*.md            # Command proposals
│       ├── plugin-*.md             # Plugin proposals
│       └── misc.md                 # Low-priority ideas
├── src/
│   ├── cli.ts                      # CLI entry point
│   ├── commands/
│   │   ├── index.ts                # Command exports
│   │   ├── fetch.ts                # Fetch command
│   │   ├── get.ts                  # Get command (by ID)
│   │   └── store.ts                # Store command
│   ├── server/
│   │   └── index.ts                # HTTP server
│   ├── services/
│   │   ├── index.ts                # Service exports
│   │   ├── web-fetcher.ts          # HTTP fetching
│   │   ├── html-parser.ts          # HTML parsing/conversion
│   │   ├── scope.ts                # Scope types and validation
│   │   ├── sandbox.ts              # QuickJS sandbox service
│   │   ├── dom-bridge.ts           # DOM bridge for sandbox
│   │   └── database.ts             # Database service
│   ├── plugins/
│   │   ├── index.ts                # Plugin registry
│   │   ├── types.ts                # Plugin interfaces
│   │   └── headings.ts             # Headings plugin
│   └── utils/
│       ├── index.ts                # Utility exports
│       ├── logger.ts               # Request logging
│       └── ttl.ts                  # TTL parsing utilities
├── tests/                          # Browser test pages
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

---

## Design Decisions

### 1. Dual Interface (CLI + Server)

Same core functionality exposed via both interfaces.
- CLI for scripting and automation
- HTTP server for service integration
- Shared service layer reduces duplication

### 2. Service Layer Architecture

Separate services for fetching and parsing.
- Single responsibility principle
- Easy to test individual components
- Allows swapping implementations

### 3. No Auto-Follow Redirects

The web fetcher does not automatically follow HTTP redirects.
- Gives clients visibility into redirect chains
- Clients decide whether to follow
- Important for SEO analysis and link checking

### 4. Default Scope: `main`

Content extraction defaults to `main` instead of `full`.
- Most use cases want article content, not navigation/footers
- Cleaner output for downstream processing
- Users can explicitly request `full`

### 5. Default Format: `markdown`

Output format defaults to `markdown` instead of `html`.
- More readable and compact
- Better for LLM consumption
- HTML available when structure needed

### 6. Request/Response Envelope

All responses wrap data in `{ request, response }`.
- Clear separation between request echo and response data
- Enables request tracking and debugging
- Consistent structure across all responses

### 7. Core vs Data Separation

Separate `include` (core fields) from `data` (plugins).
- Core fields are always available
- Plugins are extensible with options
- Clear distinction between raw/processed data and derived analysis

### 8. Port 233

Default port for local development.
- Memorable, uncommon
- Doesn't conflict with common ports (3000, 8080)
- Cloud deployments use platform-standard configuration

### 9. Server Binding

Server binds to `0.0.0.0` instead of `localhost`.
- Required for containerized deployments (Cloud Run, Docker)
- Accepts connections from any network interface
- `hostname: "0.0.0.0"` in `Bun.serve()` config

### 10. Docker: Node + Bun Hybrid

Docker uses Node.js base with Bun runtime.
- `@libsql/client` requires native binaries (`@libsql/linux-x64-gnu`)
- `npm install` properly installs native deps; `bun install` in containers does not
- Bun runs the TypeScript server; npm handles dependency installation

---

## Code Architecture

### Content Extraction

`extractContent` in `html-parser.ts`:
1. For `main` scope: Looks for `<main>`, `<article>`, or `role="main"`. Falls back to `<body>`.
2. Removes noise: `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`.
3. Converts to format:
   - `html`: Returns cleaned HTML
   - `markdown`: Uses Turndown
   - `text`: Strips tags, normalizes whitespace

### Metadata Parsing

`parseHtmlMeta` extracts:
- Basic: title, description, keywords, canonical, robots
- Indexability: Parsed from robots meta
- Heading: First H1 element
- Hreflang: Language/region alternates
- Open Graph: Social sharing metadata

### Plugin System

```typescript
interface DataPlugin<TOptions, TOutput> {
  name: string;
  description: string;
  execute(html: string, options: TOptions): TOutput | Promise<TOutput>;
}
```

Plugins registered in `src/plugins/index.ts`. To add a plugin:
1. Create file in `src/plugins/`
2. Implement `DataPlugin` interface
3. Register in `index.ts`
4. Document in `docs/implementation/plugins.md`

### Error Handling

1. **Validation (400)**: Invalid URL, scope, format, or unknown plugin
2. **Fetch (500)**: Network failures, target server errors
3. **Plugin (500)**: Plugin execution failures

### Database Service

See [database.md](database.md) for full schema and implementation details.

`DatabaseService` in `database.ts` provides optional storage of fetch results via Turso/libSQL.

---

## Build & Development

```bash
# Development
bun run cli fetch <url>       # Run CLI
bun run server                # Run server
bun run dev                   # CLI with watch
bun run dev:server            # Server with watch

# Production
bun run build                 # Compile CLI binary
bun run build:server          # Compile server binary
```

Binaries output to `dist/` and are standalone (no Bun required).
