# Site Rules

Pre-programmed and user-defined extraction rules for specific sites.

## Overview

Site rules provide custom extraction logic for specific domains/paths, enabling:
- Better content extraction for known sites
- Structured data output (JSON instead of markdown)
- Auto scope resolution

## Rule Structure

```typescript
interface SiteRule {
  id: string;
  name: string;
  description?: string;

  // Matching
  hostname: string;          // e.g., "example.com" or "*.example.com"
  pathInclude?: string[];    // Glob patterns to include
  pathExclude?: string[];    // Glob patterns to exclude

  // Extraction
  scope?: ScopeConfig;       // Custom scope definition
  format?: FormatConfig;     // Custom format definition

  // Metadata
  author: "system" | string; // "system" for built-in rules
  version: number;
  enabled: boolean;
}
```

## Matching

Rules are matched in order:

1. **Hostname match**: Exact or wildcard (`*.example.com`)
2. **Path include**: If specified, path must match at least one glob
3. **Path exclude**: If specified, path must not match any glob

```typescript
interface RuleMatch {
  hostname: string;
  pathInclude?: string[];  // e.g., ["/blog/*", "/articles/*"]
  pathExclude?: string[];  // e.g., ["/blog/archive/*"]
}
```

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

## Scope Rules

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

### Function-based

```json
{
  "scope": {
    "type": "function",
    "code": "(doc, url) => { ... }"
  }
}
```

## Format Rules

Custom output formats for structured data.

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

### Format Metadata

Response includes format info when rules are applied:

```json
{
  "response": {
    "format": "json",
    "formatSchema": "hn-item",
    "ruleApplied": {
      "id": "hn-item",
      "name": "Hacker News Item"
    }
  }
}
```

## Auto Mode

When `scope: "auto"` or `format: "auto"`:

1. Look up rules for the URL
2. If found → apply rule's scope/format
3. If not found → use defaults (`main` scope, `markdown` format)

```json
{
  "options": {
    "scope": "auto",
    "format": "auto"
  }
}
```

Response shows what was resolved:
```json
{
  "response": {
    "scopeResolved": "rule:hn-item",
    "formatResolved": "json"
  }
}
```

---

## Rules Database

### Storage

Rules stored in separate database/collection:

```sql
CREATE TABLE site_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  pathInclude TEXT,  -- JSON array
  pathExclude TEXT,  -- JSON array
  scope TEXT,        -- JSON config
  format TEXT,       -- JSON config
  author TEXT NOT NULL DEFAULT 'system',
  version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX idx_rules_hostname ON site_rules(hostname);
CREATE INDEX idx_rules_enabled ON site_rules(enabled);
```

### Built-in Rules

Ship with pre-defined rules for popular sites:

```
/rules/
  hn.json           # Hacker News
  reddit.json       # Reddit
  github.json       # GitHub
  medium.json       # Medium
  wikipedia.json    # Wikipedia
  ...
```

Loaded on startup, stored with `author: "system"`.

### API Endpoints

```
GET /rules                    # List all rules
GET /rules/:id                # Get single rule
POST /rules                   # Create rule (admin)
PUT /rules/:id                # Update rule (admin)
DELETE /rules/:id             # Delete rule (admin)
GET /rules/match?url=...      # Find matching rule for URL
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
| Admin | Admin users | Same as system |
| User | Regular users | Restricted subset (future) |

---

## CLI Commands

```bash
# List rules
webcontent rules list
webcontent rules list --hostname example.com

# Show matching rule for URL
webcontent rules match https://example.com/page

# Apply rule manually
webcontent fetch https://example.com --rule hn-item

# Manage rules (admin)
webcontent rules add rules/my-rule.json
webcontent rules update hn-item rules/hn-updated.json
webcontent rules disable hn-item
webcontent rules enable hn-item
```

---

## Example Rules

### Hacker News

```json
{
  "id": "hn-item",
  "name": "Hacker News Item",
  "hostname": "news.ycombinator.com",
  "pathInclude": ["/item*"],
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
```

### Medium

```json
{
  "id": "medium-article",
  "name": "Medium Article",
  "hostname": "*.medium.com",
  "pathExclude": ["/tag/*", "/search*", "/@*/followers"],
  "scope": {
    "type": "selector",
    "include": ["article"],
    "exclude": [".metabar", ".postActions"]
  }
}
```

---

## Implementation Steps

1. Create `site_rules` table schema
2. Implement rule matching logic
3. Implement selector scope extraction
4. Set up QuickJS for function sandboxing
5. Create built-in rules for popular sites
6. Add `/rules` API endpoints
7. Integrate with fetch: check rules for "auto" scope/format
8. Add CLI commands for rule management
9. Document rule authoring
