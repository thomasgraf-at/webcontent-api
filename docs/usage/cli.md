# CLI Usage Guide

The WebContent CLI allows you to fetch and parse web content directly from your terminal.

## Installation

If you haven't already, you can link the CLI globally:

```bash
cd webcontent
bun link
```

Now you can use the `webcontent` command anywhere.

## Basic Usage

The primary command is `fetch`, which retrieves fresh content from a URL.

```bash
webcontent fetch <url> [options]
```

Example:
```bash
webcontent fetch https://example.com
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--scope` | `-s` | Content scope: `full` or `main` | `main` |
| `--format` | `-f` | Output format: `html`, `markdown`, or `text` | `markdown` |
| `--include` | `-i` | Core response fields to include | `meta,content` |
| `--data` | `-d` | Data plugins to run | none |
| `--output` | `-o` | Write output to file | stdout |
| `--store` | - | Store results in Turso database | `false` |
| `--ttl` | - | TTL for stored record (duration format) | `30d` |
| `--client` | - | Client/Shard ID for stored record | none |
| `--help` | `-h` | Show help message | - |

### Content Scope (`--scope`)
- `main` (default): Extracts only the primary content (articles, main text). Removes noise like navigation and footers.
- `full`: Extracts the entire page body.

### Output Format (`--format`)
- `markdown` (default): Converted to clean Markdown. Ideal for reading and LLM processing.
- `html`: Raw, sanitized HTML.
- `text`: Plain text with all tags removed.

### Including Fields (`--include`)
Specify which core fields you want in the JSON response.
- Comma-separated: `--include "meta,content,headers"`
- JSON format: `--include '{"meta":true,"headers":true}'`

Available fields: `meta`, `content`, `headers`, `body`

### Data Plugins (`--data`)
Run data plugins to extract additional structured information.
- Comma-separated (default options): `--data "headings,links"`
- JSON format (with options): `--data '{"headings":{"minLevel":2}}'`

## Examples

### Basic Fetch
```bash
webcontent fetch https://example.com
```

### Save to File
```bash
webcontent fetch https://example.com -o result.json
```

### Extract Full HTML
```bash
webcontent fetch https://example.com --scope full --format html -o page.html
```

### Include Raw Headers
```bash
webcontent fetch https://example.com --include '{"meta":true,"headers":true}'
```

### Extract Headings
```bash
webcontent fetch https://example.com --data headings
```

### Extract Headings with Options
```bash
webcontent fetch https://example.com --data '{"headings":{"minLevel":1,"maxLevel":3}}'
```

### Multiple Data Plugins
```bash
webcontent fetch https://example.com --data headings,links
```

### Database Storage
Store the result in Turso database with a custom TTL and client ID:
```bash
webcontent fetch https://example.com --store --ttl 7d --client "my-app-1"
```

**TTL Duration Formats**:
- Seconds: `3600`
- Minutes: `60min`, `60m`
- Hours: `6hours`, `6h`
- Days: `7days`, `7d`
- Months: `3months`, `3mo`
- Years: `1year`, `1y`

> [!NOTE]
> Database storage requires `TURSO_URL` and optionally `TURSO_AUTH_TOKEN` environment variables to be set.

---

## Store Command

The `store` command allows you to store page data directly in the database without fetching.

```bash
webcontent store <url> [options]
```

### Required

- `<url>`: URL for the record (must start with http:// or https://)
- At least one of: `--body`, `--content`, or `--data`

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--status` | HTTP status code | `200` |
| `--title` | Page title | none |
| `--content` | Extracted content | none |
| `--body` | Raw HTML body | none |
| `--meta` | Page metadata as JSON | `{}` |
| `--data` | Plugin data as JSON | `{}` |
| `--options` | Request options as JSON | `{}` |
| `--ttl` | TTL for stored record (duration format) | `30d` |
| `--client` | Client/shard identifier | none |

### Examples

```bash
# Store simple content
webcontent store https://example.com --content "Page content here"

# Store with title and body
webcontent store https://example.com --body "<html>...</html>" --title "Example Page"

# Store structured data
webcontent store https://example.com --data '{"headings":[{"level":1,"text":"Title"}]}'

# Store with TTL and client
webcontent store https://example.com --content "Content" --ttl 7d --client "my-app"
```

---

## Get Command

The `get` command retrieves a stored page by its ID.

```bash
webcontent get --id <page-id> [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--id` | - | Page ID to retrieve (required) |
| `--client` | - | Client/shard identifier (for isolation) |
| `--output` | `-o` | Write output to file |

### Examples

```bash
# Get page by ID
webcontent get --id V1StGXR8_Z5j

# Get with client isolation
webcontent get --id V1StGXR8_Z5j --client my-app

# Save to file
webcontent get --id V1StGXR8_Z5j -o page.json
```

---

## Gets Command

The `gets` command retrieves multiple stored pages by their IDs.

```bash
webcontent gets --ids <id1,id2,...> [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--ids` | - | Comma-separated page IDs (required, max 100) |
| `--client` | - | Client/shard identifier (for isolation) |
| `--output` | `-o` | Write output to file |

### Examples

```bash
# Get multiple pages
webcontent gets --ids V1StGXR8_Z5j,abc123def456

# Get with client isolation
webcontent gets --ids V1StGXR8_Z5j,abc123def456 --client my-app

# Save to file
webcontent gets --ids V1StGXR8_Z5j,abc123def456 -o pages.json
```

---

## Output Format

All output is JSON with a request/response envelope.

### Fetch Response

```json
{
  "request": {
    "url": "https://example.com",
    "options": {
      "scope": "main",
      "format": "markdown",
      "data": { "headings": true }
    }
  },
  "response": {
    "id": "V1StGXR8_Z5j",
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "redirect": null,
    "meta": { ... },
    "content": "...",
    "data": {
      "headings": [
        { "level": 1, "text": "Title" }
      ]
    }
  }
}
```

> [!NOTE]
> The `id` field is only present when `--store` is used.

### Store Response

```json
{
  "stored": true,
  "id": "V1StGXR8_Z5j",
  "url": "https://example.com",
  "timestamp": 1700000000000,
  "deleteAt": 1702592000000
}
```

### Get Response

```json
{
  "request": { "id": "V1StGXR8_Z5j" },
  "response": {
    "id": "V1StGXR8_Z5j",
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "meta": { ... },
    "content": "...",
    "data": { ... },
    "cached": true
  }
}
```

### Gets Response

```json
{
  "count": 2,
  "results": [
    {
      "id": "V1StGXR8_Z5j",
      "url": "https://example.com",
      "title": "Example",
      "domain": "example.com",
      "hostname": "www.example.com",
      "timestamp": 1700000000000,
      "status": 200,
      "meta": { ... },
      "content": "...",
      "data": { ... }
    },
    ...
  ]
}
```
