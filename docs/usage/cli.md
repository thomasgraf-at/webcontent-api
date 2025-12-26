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
| `--ttl` | - | Custom TTL in seconds when storing | 30 days |
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
Store the result in Turso database with a 1-hour TTL and custom client ID:
```bash
webcontent fetch https://example.com --store --ttl 3600 --client "my-app-1"
```

> [!NOTE]
> Database storage requires `TURSO_URL` and optionally `TURSO_AUTH_TOKEN` environment variables to be set.

## Output Format

All output is JSON with a request/response envelope:

```json
{
  "request": {
    "url": "https://example.com",
    "options": { "scope": "main", "format": "markdown" },
    "data": { "headings": true }
  },
  "response": {
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
