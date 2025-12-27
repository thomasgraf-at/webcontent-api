# Scope Implementation

Extended content extraction scopes for the WebContent API.

## Implemented Scopes

| Scope | Status | Description |
|-------|--------|-------------|
| `main` | ✅ | Extract main content using Readability-like algorithm |
| `full` | ✅ | Full page body |
| `auto` | ✅ | Auto-detect (falls back to `main`, site handlers TBD) |
| `selector` | ✅ | CSS selector-based extraction |
| `function` | ✅ | Custom JavaScript in QuickJS sandbox |
| `handler` | ⏳ | Reference to site handlers database (planned) |

## Files

- `src/services/scope.ts` - Type definitions and utilities
- `src/services/sandbox.ts` - QuickJS sandbox service
- `src/services/html-parser.ts` - Extraction functions

## Scope Type Definition

```typescript
type Scope =
  | "main"
  | "full"
  | "auto"
  | { type: "selector"; include: string[]; exclude?: string[] }
  | { type: "function"; code: string }
  | { type: "handler"; id: string };
```

## Selector Scope

Extracts content matching CSS selectors.

```json
{
  "scope": {
    "type": "selector",
    "include": ["article", ".content"],
    "exclude": [".ads", "nav"]
  }
}
```

CLI shorthand: `--scope 'selector:article,.content' --exclude '.ads,nav'`

Implementation in `extractBySelector()`:
1. Parse HTML with node-html-parser
2. Remove script, style, noscript, iframe, svg elements
3. Remove images with data: URIs
4. Find all elements matching include selectors (deduplicated)
5. Remove excluded elements from matched elements
6. Combine innerHTML from all matches

> **Note**: Elements are deduplicated, so overlapping selectors like `[".menu", "menu", "#menu"]` that match the same element will only include it once.

## Function Scope

Custom JavaScript extraction in sandboxed QuickJS/WASM environment.

```json
{
  "scope": {
    "type": "function",
    "code": "(doc, url) => doc.getText('h1')"
  }
}
```

### Sandbox API

The `doc` object provides:
- `doc.html` - Raw HTML string
- `doc.getText(selector)` - Get text from matching elements
- `doc.getInnerHTML(selector)` - Get innerHTML of first match
- `doc.getAllInnerHTML(selector)` - Get array of all matches' innerHTML
- `doc.getAttribute(selector, attr)` - Get attribute value

Selector support: tag names (`h1`, `p`), classes (`.foo`), IDs (`#bar`)

### Security Restrictions

The QuickJS sandbox blocks:
- Network access (`fetch` disabled)
- File system access
- Timers (setTimeout, setInterval - no-ops)
- 5 second execution timeout

### Dependencies

- `@sebastianwessel/quickjs` - QuickJS wrapper
- `@jitl/quickjs-ng-wasmfile-release-sync` - QuickJS WASM binary

## Response Fields

When `--debug` flag (CLI) or `debug=true` (API) is requested, scope info appears at the top level:

```json
{
  "request": { ... },
  "result": {
    "content": "..."
  },
  "debug": {
    "scope": {
      "requested": "auto",
      "used": "main",
      "resolved": true,
      "handlerId": "example-handler"
    }
  }
}
```

- `debug.scope.requested` - The scope originally requested
- `debug.scope.used` - The actual scope applied (may differ for `auto`)
- `debug.scope.resolved` - `true` if scope was auto-resolved
- `debug.scope.handlerId` - Site handler ID if matched (optional)

> **Note**: The `debug` field is only included when explicitly requested.

## Auto Scope

Currently falls back to `main`. When site handlers are implemented:
1. Check site handlers database for hostname match
2. If handler found with custom scope → use it
3. If no handler → fall back to `main`

The `debug.scope.resolved: true` flag indicates auto-resolution occurred.
