# Scope Options

Extended content extraction scopes beyond `main` and `full`.

## Current Scopes

| Scope | Description |
|-------|-------------|
| `main` | Extract main content using Readability |
| `full` | Full page body |

## New Scopes

### `selector` - CSS Selector

Extract content matching CSS selectors.

```json
{
  "options": {
    "scope": {
      "type": "selector",
      "include": ["article", ".post-content", "#main"],
      "exclude": [".ads", ".sidebar", "nav"]
    }
  }
}
```

**Behavior**:
1. Find all elements matching `include` selectors
2. Remove elements matching `exclude` selectors from results
3. Combine remaining content

**Multiple includes**: Content from all matching selectors is concatenated.

**CLI**:
```bash
webcontent fetch https://example.com --scope 'selector:article,.content' --exclude '.ads,nav'
```

---

### `function` - Custom Callback

Provide extraction logic as a JavaScript function string.

```json
{
  "options": {
    "scope": {
      "type": "function",
      "code": "(doc) => doc.querySelector('article')?.innerHTML || ''"
    }
  }
}
```

**Function signature**:
```typescript
type ScopeFunction = (doc: Document, url: string) => string | object;
```

- `doc`: Parsed DOM document
- `url`: The page URL (for context)
- Returns: HTML string or structured object

**Security**: Custom functions are executed in a sandboxed QuickJS environment via WebAssembly. See [site-rules.md](./site-rules.md#sandboxing) for details on:
- QuickJS/WASM isolation
- Available APIs (DOM parsing, string manipulation, JSON, regex)
- Restrictions (no filesystem, network, timers, global state)
- Trust levels for system vs user-defined functions

---

### `auto` - Automatic Detection

Automatically select the best extraction method.

```json
{
  "options": {
    "scope": "auto"
  }
}
```

**Resolution order**:
1. Check site rules database for hostname match
2. If rule found with custom scope → use it
3. If no rule → fall back to `main`

---

## Scope Type Definition

```typescript
type Scope =
  | "main"
  | "full"
  | "auto"
  | {
      type: "selector";
      include: string[];
      exclude?: string[];
    }
  | {
      type: "function";
      code: string;
    }
  | {
      type: "rule";
      name: string;  // Reference to site rule
    };
```

---

## Options Hash Impact

For caching, scope must be normalized:
- `"main"` and `"full"` hash as strings
- `"auto"` hashes as the resolved scope (what was actually used)
- Objects hash their full structure

Response includes what was actually used:
```json
{
  "response": {
    "scopeUsed": "main",
    "scopeResolved": true
  }
}
```

---

## Implementation

### Selector Scope

```typescript
function extractBySelector(
  doc: Document,
  include: string[],
  exclude: string[] = []
): string {
  const elements: Element[] = [];

  for (const selector of include) {
    elements.push(...doc.querySelectorAll(selector));
  }

  // Remove excluded elements
  for (const el of elements) {
    for (const excludeSelector of exclude) {
      el.querySelectorAll(excludeSelector).forEach(e => e.remove());
    }
  }

  return elements.map(el => el.innerHTML).join('\n');
}
```

### Function Scope

Uses isolated VM or QuickJS for sandboxing. See [Site Rules](#site-rules-database).
