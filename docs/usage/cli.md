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
| `--include` | `-i` | Response fields to include | `meta,content` |
| `--output` | `-o` | Write output to file | stdout |

### Content Scope (`--scope`)
- `main` (default): Extracts only the primary content (articles, main text). Removes noise like navigation and footers.
- `full`: Extracts the entire page body.

### Output Format (`--format`)
- `markdown` (default): Converted to clean Markdown. Ideal for reading and LLM processing.
- `html`: Raw, sanitized HTML.
- `text`: Plain text with all tags removed.

### Including Fields (`--include`)
Specify which fields you want in the JSON response.
- Example: `--include "meta,content,headers"`
- JSON format is also supported: `--include '{"meta":true,"headers":true}'`

## Advanced Examples

### Saving to a File
```bash
webcontent fetch https://example.com -o result.json
```

### Extracting Full HTML to a file
```bash
webcontent fetch https://example.com --scope full --format html -o page.html
```

### Using JSON for Includes
```bash
webcontent fetch https://example.com --include '{"meta":true,"body":true}'
```
