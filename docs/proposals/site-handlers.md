# Site Handlers

Pre-programmed and user-defined extraction handlers for specific sites.

## Overview

Site handlers provide custom extraction logic for specific domains/paths, enabling:
- Better content extraction for known sites
- Structured data output (JSON instead of markdown)
- Auto scope resolution

## Handler Structure

```typescript
interface SiteHandler {
  id: string;
  name: string;
  description?: string;

  // Matching
  hostname: string;          // e.g., "example.com" or "*.example.com"
  pathInclude?: string[];    // Glob patterns to include
  pathExclude?: string[];    // Glob patterns to exclude

  // Request options to apply
  options?: HandlerOptions;  // Flexible options object

  // Metadata
  author: "system" | string; // "system" for built-in handlers
  version: number;
  enabled: boolean;
}

interface HandlerOptions {
  scope?: ScopeConfig;       // Custom extraction scope
  format?: FormatConfig;     // Custom output format
  // Future: headers, timeout, render, etc.
}
```

## Matching

Handlers are matched in order:

1. **Hostname match**: Exact or wildcard (`*.example.com`)
2. **Path include**: If specified, path must match at least one pattern
3. **Path exclude**: If specified, path must not match any pattern

```typescript
interface HandlerMatch {
  hostname: string;
  pathInclude?: string[];  // e.g., ["/blog/*", "/articles/*"]
  pathExclude?: string[];  // e.g., ["/blog/archive/*"]
}
```

### Path Pattern Syntax

Patterns use glob-style matching:
- `*` matches any characters within a single path segment
- `**` matches any characters across multiple path segments
- Patterns without wildcards are **exact matches**

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `/` | `/` only | `/about`, `/blog` |
| `/blog/*` | `/blog/post1`, `/blog/123` | `/blog`, `/blog/a/b` |
| `/*/stories/*` | `/news/stories/123` | `/stories/123` |
| `/**` | any path | - |

### Examples

```json
{
  "hostname": "news.ycombinator.com",
  "pathInclude": ["/item*"]
}
```

```json
{
  "hostname": "*.medium.com",
  "pathExclude": ["/tag/*", "/search*"]
}
```

```json
{
  "hostname": "traffic3.net",
  "pathExclude": ["/"],
  "comment": "Match all pages except index"
}
```

```json
{
  "hostname": "orf.at",
  "pathInclude": ["/*/stories/*"],
  "comment": "Match story pages like /news/stories/123"
}
```

## Scope Handlers

### Selector-based

```json
{
  "scope": {
    "type": "selector",
    "include": ["article.post", ".story-content"],
    "exclude": [".related-posts", ".author-bio"]
  }
}
```

**Selector syntax**: Any valid CSS selector works:
- IDs: `#main`, `#content`
- Classes: `.article`, `.post-content`
- Tags: `article`, `main`, `ad-container` (including custom elements)
- Combinations: `article.post`, `#main > .content`
- Attributes: `[data-type="article"]`

### Function-based

```json
{
  "scope": {
    "type": "function",
    "code": "(doc, url) => { ... }"
  }
}
```

## Format Handlers

Custom output formats for structured data.

**Note**: Both `scope` and `format` are optional in handlers:
- If `scope` is omitted → uses default scope (`main`)
- If `format` is omitted → uses user-specified format (respects request options)

This allows handlers to only override what's needed. For example, a handler can define custom selectors while still letting users choose markdown/text/html output.

```typescript
interface FormatConfig {
  type: "html" | "markdown" | "text" | "json";
  schema?: string;           // JSON schema name for validation
  transform?: string;        // Transform function code
}
```

### Structured JSON Output

For sites with predictable structure, output JSON instead of text:

```json
{
  "format": {
    "type": "json",
    "schema": "article",
    "transform": "(doc, url) => ({ title: ..., author: ..., content: ... })"
  }
}
```

**Response**:
```json
{
  "response": {
    "format": "json",
    "formatSchema": "article",
    "content": {
      "title": "Article Title",
      "author": "Author Name",
      "publishedAt": "2024-01-15",
      "content": "..."
    }
  }
}
```

### Handler Metadata in Response

When a handler is applied, the full handler data is included in a separate `handler` field (not inside `response`). Function code is excluded for security/size reasons.

```json
{
  "request": { ... },
  "response": {
    "timestamp": 1703123456789,
    "url": "https://news.ycombinator.com/item?id=123",
    "status": 200,
    "content": { ... }
  },
  "handler": {
    "id": "hn-item",
    "name": "Hacker News Item",
    "hostname": "news.ycombinator.com",
    "pathInclude": ["/item*"],
    "options": {
      "scope": {
        "type": "selector",
        "include": [".fatitem"],
        "exclude": [".reply"]
      },
      "format": {
        "type": "json",
        "schema": "hn-item"
      }
    },
    "applied": {
      "scope": true,
      "format": true
    }
  }
}
```

The `handler` field is only present when a handler was matched. Contains:
- Full handler definition (id, name, hostname, pathInclude/Exclude, options)
- `applied` object showing which options were actually used
- **Excluded**: Function code (`scope.code`, `format.transform`) for security

## Auto Mode

When `scope: "auto"` or `format: "auto"`:

1. Look up handlers for the URL
2. If found → apply handler's scope/format
3. If not found → use defaults (`main` scope, `markdown` format)

```json
{
  "options": {
    "scope": "auto",
    "format": "auto"
  }
}
```

Response includes full handler info when matched:
```json
{
  "response": { ... },
  "handler": {
    "id": "hn-item",
    "name": "Hacker News Item",
    "hostname": "news.ycombinator.com",
    "pathInclude": ["/item*"],
    "options": { ... },
    "applied": {
      "scope": true,
      "format": true
    }
  }
}
```

---

## Handlers Database

### Storage

Handlers stored in separate database/collection:

```sql
CREATE TABLE site_handlers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  pathInclude TEXT,  -- JSON array
  pathExclude TEXT,  -- JSON array
  options TEXT,      -- JSON: { scope?, format?, ...future options }
  author TEXT NOT NULL DEFAULT 'system',
  version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_handlers_hostname ON site_handlers(hostname);
CREATE INDEX idx_handlers_enabled ON site_handlers(enabled);
```

**Options field**: A flexible JSON object containing any request options the handler should override:

```typescript
interface HandlerOptions {
  scope?: ScopeConfig;    // Custom extraction scope
  format?: FormatConfig;  // Custom output format
  // Future: headers, timeout, etc.
}
```

This keeps the schema stable as new options are added.

### Built-in Handlers

Ship with pre-defined handlers for popular sites:

```
/site-handlers/
  hn.json           # Hacker News
  reddit.json       # Reddit
  github.json       # GitHub
  medium.json       # Medium
  wikipedia.json    # Wikipedia
  ...
```

Loaded on startup, sync/store with `author: "system"`.

### API Endpoints

```
GET /handlers                    # List all handlers
GET /handlers/:id                # Get single handler
POST /handlers                   # Create handler (admin)
PUT /handlers/:id                # Update handler (admin)
DELETE /handlers/:id             # Delete handler (admin)
GET /handlers/match?url=...      # Find matching handler for URL
```

---

## Sandboxing

Custom functions must be sandboxed for security.

### Approach: QuickJS via WebAssembly

Use [`@sebastianwessel/quickjs`](https://www.npmjs.com/package/quickjs-emscripten) for isolated JavaScript execution. This is built on [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) which compiles QuickJS to WebAssembly.

**Why QuickJS?**
- Pure JavaScript + WASM - no native dependencies
- Works with Bun out of the box (Bun has [native WASM support](https://bun.sh/docs/runtime/loaders))
- Works on Google Cloud Run (just WASM, no special runtime needed)
- [Version 2.0 (2024)](https://sebastianwessel.github.io/quickjs/blog/2024-09-01-version-2.html) adds async support and context reuse

**Alternatives considered**:
- `isolated-vm` - V8 isolates, requires native compilation (complicates Cloud Run builds)
- `vm2` - Deprecated, security issues
- `SES (Secure ECMAScript)` - Hardened JS, less isolation

### Implementation

```typescript
import { quickJS } from "@aspect-dev/quickjs";

async function runScopeFn(code: string, html: string, url: string): Promise<string> {
  const runtime = await quickJS();

  try {
    // Provide DOM-like API via linkedom
    const result = await runtime.evalCode(`
      const doc = parseHTML(${JSON.stringify(html)});
      const url = ${JSON.stringify(url)};
      (${code})(doc, url);
    `);

    return result;
  } finally {
    runtime.dispose();
  }
}
```

**Package options**:
- `@sebastianwessel/quickjs` - Higher-level, recommended
- `@jitl/quickjs-ng-wasmfile-release-sync` - Lower-level, fastest variant

### Restrictions

Sandboxed functions cannot:
- Access filesystem
- Make network requests
- Use timers (setTimeout, etc.)
- Access global state

Available APIs:
- DOM parsing/traversal (linkedom or similar)
- String manipulation
- JSON operations
- Regular expressions

### Trust Levels

| Level | Author | Capabilities |
|-------|--------|--------------|
| System | `"system"` | Full DOM access, all built-in APIs |
| User | Regular users | Restricted subset (future) |

---

## CLI Commands

```bash
# List handlers
webcontent handlers list
webcontent handlers list --hostname example.com

# Show matching handler for URL
webcontent handlers match https://example.com/page

# Apply handler manually
webcontent fetch https://example.com --handler hn-item

# Manage handlers (admin)
webcontent handlers add handlers/my-handler.json
webcontent handlers update hn-item handlers/hn-updated.json
webcontent handlers disable hn-item
webcontent handlers enable hn-item
```

---

## Example Handlers

### Hacker News

```json
{
  "id": "hn-item",
  "name": "Hacker News Item",
  "hostname": "news.ycombinator.com",
  "pathInclude": ["/item*"],
  "options": {
    "scope": {
      "type": "selector",
      "include": [".fatitem"],
      "exclude": [".reply"]
    },
    "format": {
      "type": "json",
      "schema": "hn-item",
      "transform": "(doc, url) => ({ id: new URL(url).searchParams.get('id'), title: doc.querySelector('.titleline a')?.textContent, ... })"
    }
  }
}
```

### Medium

```json
{
  "id": "medium-article",
  "name": "Medium Article",
  "hostname": "*.medium.com",
  "pathExclude": ["/tag/*", "/search*", "/@*/followers"],
  "options": {
    "scope": {
      "type": "selector",
      "include": ["article"],
      "exclude": [".metabar", ".postActions"]
    }
  }
}
```

### Traffic3 (scope only, user controls format)

```json
{
  "id": "traffic3-articles",
  "name": "Traffic3 Articles",
  "hostname": "traffic3.net",
  "pathExclude": ["/"],
  "options": {
    "scope": {
      "type": "selector",
      "include": ["#main", ".sections"]
    }
  }
}
```

Handler only sets extraction selectors. Format (markdown/text/html) is determined by the user's request.

### ORF Stories

```json
{
  "id": "orf-stories",
  "name": "ORF News Stories",
  "hostname": "orf.at",
  "pathInclude": ["/*/stories/*"],
  "options": {
    "scope": {
      "type": "selector",
      "include": ["#content"]
    }
  }
}
```

Matches paths like `/news/stories/123456`, `/sport/stories/789`.

### Der Standard (exclude custom elements)

```json
{
  "id": "derstandard-story",
  "name": "Der Standard Story",
  "hostname": "www.derstandard.at",
  "pathInclude": ["/story/*"],
  "options": {
    "scope": {
      "type": "selector",
      "include": ["#main"],
      "exclude": ["ad-container"]
    }
  }
}
```

Excludes `<ad-container>` custom elements from extracted content.

### Half Baked Harvest (multiple include selectors)

```json
{
  "id": "halfbaked-recipes",
  "name": "Half Baked Harvest Recipes",
  "hostname": "halfbakedharvest.com",
  "pathExclude": ["/"],
  "options": {
    "scope": {
      "type": "selector",
      "include": [".page-header", ".site-main"]
    }
  }
}
```

Combines content from multiple selectors.

---

## Implementation Steps

1. Create `site_handlers` table schema
2. Implement handler matching logic
3. Implement selector scope extraction
4. Set up QuickJS for function sandboxing
5. Create built-in handlers for popular sites
6. Add `/handlers` API endpoints
7. Integrate with fetch: check handlers for "auto" scope/format
8. Add CLI commands for handler management
9. Document handler authoring
