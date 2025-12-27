# Handler Function APIs

This document specifies the APIs available to handler functions. It serves as a reference for implementing compatible handler function environments in other projects.

## Overview

Handler functions are JavaScript functions that run in a sandboxed environment to extract or transform content from HTML. They receive an `api` object providing DOM-like query capabilities and the page URL.

```javascript
(api, url) => {
  // extraction logic
  return result;
}
```

## Execution Environment

Handler functions execute in a QuickJS/WASM sandbox with:
- No network access (fetch blocked)
- No filesystem access
- No timers (setTimeout/setInterval are no-ops)
- Isolated global state (nothing persists between executions)
- Configurable timeout (default 5s, max 60s)

## API Object

The `api` object is the primary interface for querying HTML content.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `api.html` | `string` | The raw HTML string being processed |
| `api.url` | `string` | The URL of the page |

### Query Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `api.$` | `(selector: string) => Node \| null` | Returns first matching element |
| `api.$$` | `(selector: string) => Node[]` | Returns all matching elements |
| `api.querySelector` | `(selector: string) => Node \| null` | Alias for `$()` |
| `api.querySelectorAll` | `(selector: string) => Node[]` | Alias for `$$()` |

Selectors support full CSS syntax including:
- Tag names: `h1`, `article`, `div`
- Classes: `.content`, `.article-body`
- IDs: `#main`, `#content`
- Attributes: `[data-id]`, `[href^="https://"]`
- Combinators: `article h1`, `.post > p`, `h1 + p`, `h1 ~ p`
- Pseudo-classes: `:first-child`, `:last-child`, `:nth-child(n)`

## Node Object

Nodes returned by query methods have the following interface:

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `node.tag` | `string` | Tag name in lowercase (e.g., `"div"`, `"h1"`) |
| `node.text` | `string` | Text content with block-aware normalization |
| `node.html` | `string` | innerHTML of the element |
| `node.outerHtml` | `string` | outerHTML of the element |
| `node.attrs` | `Record<string, string>` | All attributes as key-value pairs |
| `node.dataAttrs` | `Record<string, string>` | Data attributes without `data-` prefix |
| `node.classes` | `string[]` | Array of class names |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `node.attr` | `(name: string) => string \| null` | Get attribute value |
| `node.dataAttr` | `(name: string) => string \| null` | Get data attribute (without `data-` prefix) |
| `node.hasClass` | `(name: string) => boolean` | Check if element has class |
| `node.$` | `(selector: string) => Node \| null` | Query within this element |
| `node.$$` | `(selector: string) => Node[]` | Query all within this element |
| `node.closest` | `(selector: string) => Node \| null` | Find closest matching ancestor |
| `node.parent` | `(selector?: string) => Node \| null` | Get parent, optionally matching selector |

### Traversal Properties

| Property | Type | Description |
|----------|------|-------------|
| `node.children` | `Node[]` | Direct child elements |
| `node.firstChild` | `Node \| null` | First child element |
| `node.lastChild` | `Node \| null` | Last child element |
| `node.nextSibling` | `Node \| null` | Next sibling element |
| `node.prevSibling` | `Node \| null` | Previous sibling element |

## Text Extraction

The `node.text` property returns normalized text content:

1. **Block-aware**: Newlines are inserted after block elements (p, div, h1-h6, li, tr, br, article, section, etc.)
2. **Whitespace normalized**: Multiple spaces collapse to single space
3. **Trimmed**: Leading/trailing whitespace removed

This produces readable text output that respects document structure.

## Return Values

Handler functions can return:

| Return Type | Result |
|-------------|--------|
| `string` | Returned directly as content |
| `object` | JSON-stringified and returned as content |
| `null`/`undefined` | Empty string content |

## Implementation Notes

### Host-Side Parsing

For security and performance, HTML parsing should occur on the host side (not in the sandbox):

1. Parse HTML using a DOM library (e.g., linkedom, jsdom)
2. Pre-extract selectors from the function code
3. Pre-cache query results for known selectors
4. Serialize node data to pass into the sandbox
5. Execute the function with serialized API in the sandbox

### Selector Pre-Caching

Extract selectors from function code using patterns:
- `$('selector')` and `$$('selector')`
- `querySelector('selector')` and `querySelectorAll('selector')`
- `closest('selector')`

Pre-execute these queries and cache results before sandbox execution.

### Node Serialization

Nodes are serialized with an internal `_id` for referencing:

```typescript
interface SerializedNodeData {
  _id: number;
  tag: string;
  text: string;
  html: string;
  outerHtml: string;
  attrs: Record<string, string>;
  dataAttrs: Record<string, string>;
  classes: string[];
}
```

Child queries and traversal results are also pre-computed and cached by node ID.

## TypeScript Interfaces

```typescript
interface HandlerAPI {
  html: string;
  url: string;
  $(selector: string): Node | null;
  $$(selector: string): Node[];
  querySelector(selector: string): Node | null;
  querySelectorAll(selector: string): Node[];
}

interface Node {
  tag: string;
  text: string;
  html: string;
  outerHtml: string;
  attrs: Record<string, string>;
  dataAttrs: Record<string, string>;
  classes: string[];

  attr(name: string): string | null;
  dataAttr(name: string): string | null;
  hasClass(name: string): boolean;
  $(selector: string): Node | null;
  $$(selector: string): Node[];
  closest(selector: string): Node | null;
  parent(selector?: string): Node | null;

  children: Node[];
  firstChild: Node | null;
  lastChild: Node | null;
  nextSibling: Node | null;
  prevSibling: Node | null;
}

type HandlerFunction = (api: HandlerAPI, url: string) => unknown;
```

## Example Implementation

See `src/services/sandbox.ts` and `src/services/dom-bridge.ts` for the reference implementation using QuickJS/WASM and linkedom.
