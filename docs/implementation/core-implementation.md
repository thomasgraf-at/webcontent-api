# WebContent Implementation

## Tech Stack

| Component   | Technology       | Purpose                                               |
|-------------|------------------|-------------------------------------------------------|
| Runtime     | Bun              | Native TypeScript, fast execution, binary compilation |
| Language    | TypeScript       | Type safety, better DX                                |
| HTML Parser | node-html-parser | Fast HTML parsing without DOM overhead                |
| Markdown    | Turndown         | HTML to Markdown conversion                           |
| Database    | Turso (libSQL)   | Optional storage of fetch results                     |

## Dependencies

```json
{
  "dependencies": {
    "@libsql/client": "^0.15.15",
    "node-html-parser": "^6.1.13",
    "turndown": "^7.2.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.2"
  }
}
```

---

## Project Structure

```
webcontent/
├── docs/
│   ├── specs/
│   │   ├── core-specs.md           # Product specification
│   │   ├── implementation-checklist.md
│   │   └── documentation-style.md  # Doc guidelines
│   ├── implementation/
│   │   ├── core-implementation.md  # This file
│   │   └── database.md             # Database schema and service
│   ├── usage/
│   │   ├── cli.md                  # CLI usage guide
│   │   ├── api.md                  # HTTP API reference
│   │   └── deploy.md               # Deployment guide
│   └── planning/
│       ├── proposals.md            # Feature proposals
│       ├── plugins.md              # Plugin roadmap
│       └── database.md             # Database future plans
├── src/
│   ├── cli.ts                      # CLI entry point
│   ├── commands/
│   │   ├── index.ts                # Command exports
│   │   └── fetch.ts                # Fetch command
│   ├── server/
│   │   └── index.ts                # HTTP server
│   ├── services/
│   │   ├── index.ts                # Service exports
│   │   ├── web-fetcher.ts          # HTTP fetching
│   │   ├── html-parser.ts          # HTML parsing/conversion
│   │   └── database.ts             # Database service
│   └── plugins/
│       ├── index.ts                # Plugin registry
│       ├── types.ts                # Plugin interfaces
│       └── headings.ts             # Headings plugin
├── test.html                       # Browser test page
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
4. Document in `docs/planning/plugins.md`

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
