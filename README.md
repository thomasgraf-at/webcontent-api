# WebContent

Web content fetching API - available as both CLI and HTTP server.

## Installation

```bash
cd webcontent
bun install
```

## CLI Usage

```bash
# Run directly
bun run cli fetch https://example.com

# Or link globally
bun link
webcontent fetch https://example.com
```

### Commands

#### `webcontent fetch <url>`

Fetch a web page (always fresh, bypasses cache).

```bash
webcontent fetch <url> [options]
```

**Options:**

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--content` | `-c` | Content type: `full` or `main` | `main` |
| `--format` | `-f` | Output format: `html`, `markdown`, or `text` | `html` |
| `--output` | `-o` | Write output to file | stdout |
| `--help` | `-h` | Show help | - |

**Examples:**

```bash
# Basic fetch
webcontent fetch https://example.com

# Extract main content as Markdown
webcontent fetch https://example.com -c main -f markdown

# Save to file
webcontent fetch https://example.com -o result.json
```

## Server Usage

```bash
# Run server (default port 233 for local dev)
bun run server

# With custom port
PORT=8080 bun run server
```

### API Endpoints

#### `GET /health`

Health check endpoint.

```bash
curl http://localhost:233/health
```

#### `GET /fetch`

Fetch a web page using query parameters.

```bash
curl "http://localhost:233/fetch?url=https://example.com"
curl "http://localhost:233/fetch?url=https://example.com&content=main&format=markdown"
```

**Query Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | URL to fetch (required) | - |
| `content` | `full` or `main` | `main` |
| `format` | `html`, `markdown`, or `text` | `html` |

#### `POST /fetch`

Fetch a web page using JSON body.

```bash
curl -X POST http://localhost:233/fetch \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "content": "main", "format": "markdown"}'
```

**Request Body:**

```json
{
  "url": "https://example.com",
  "content": "main",
  "format": "markdown"
}
```

### Response Format

```json
{
  "url": "https://example.com",
  "statusCode": 200,
  "redirect": null,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "meta": {
    "title": "Example Domain",
    "description": "...",
    "keywords": null,
    "canonical": "https://example.com/",
    "robots": null,
    "index": true,
    "heading": "Example Domain",
    "hreflang": [],
    "opengraph": {
      "title": null,
      "description": null,
      "image": null,
      "url": null,
      "type": null,
      "siteName": null
    }
  },
  "content": "..."
}
```

## Build

```bash
# Build CLI binary
bun run build

# Build server binary
bun run build:server
```

## Project Structure

```
webcontent/
├── docs/
│   ├── specs/
│   │   ├── core.md                # Component Specifications
│   │   └── documentation-style.md # Documentation Philosophy
│   ├── implementation/
│   │   └── architecture.md        # Technical Design
│   ├── planning/
│   │   └── proposals.md           # Future Enhancements
│   └── usage/
│       ├── cli.md                 # CLI Usage Guide
│       ├── server.md              # Server Usage Guide
│       └── api.md                 # HTTP API Guide
├── src/
│   ├── cli.ts
│   ├── ...
├── test.html
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
