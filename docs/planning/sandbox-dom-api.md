# Hybrid DOM API for Handler Functions

> **Status**: Implemented

Enhanced DOM API for handler functions using host-side parsing with linkedom and exposing rich query/traversal methods to the sandbox.

See [Handler APIs](../implementation/handler-apis.md) for the implementation reference and [Handler Functions Guide](../usage/handler-functions.md) for usage documentation.

## Overview

Currently, function scope uses regex-based selectors which are limited. This plan introduces a hybrid approach:

1. Parse HTML on the host side using **linkedom** (full DOM implementation)
2. Expose a rich, serializable API to the sandbox
3. Enable querySelector, traversal, and attribute access

## Why linkedom?

| Library | Size | Speed | DOM Compliance | Decision |
|---------|------|-------|----------------|----------|
| **linkedom** | ~50KB | Fast | Good | Selected |
| node-html-parser | ~30KB | Fastest | Limited (no closest, partial selectors) | Already using, but lacks features |
| jsdom | ~2MB | Slow | Excellent | Too heavy |
| cheerio | ~100KB | Fast | jQuery-like, not standard DOM | Non-standard API |
| happy-dom | ~80KB | Fast | Good | Alternative option |

linkedom provides full DOM compliance with `closest()`, complex selectors, and standard APIs while remaining lightweight.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Host (Node/Bun)                          │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐   │
│  │   linkedom   │───▶│  DOM Bridge  │───▶│ Serialized    │   │
│  │   parseHTML  │    │  (queries)   │    │ API Methods   │   │
│  └─────────────┘    └──────────────┘    └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  QuickJS Sandbox (WASM)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  api.querySelector('article h1')                         ││
│  │    → returns SerializedNode                              ││
│  │  node.text / node.html / node.attr('href')               ││
│  │    → returns pre-serialized data                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## API Design

### Top-Level API Object

The sandbox receives an `api` object (replacing `doc`) with these methods:

```typescript
interface SandboxAPI {
  // Raw HTML string
  html: string;

  // URL of the page
  url: string;

  // Query methods - return SerializedNode or null
  querySelector(selector: string): SerializedNode | null;
  querySelectorAll(selector: string): SerializedNode[];

  // Convenience shortcuts
  $: (selector: string) => SerializedNode | null;      // alias for querySelector
  $$: (selector: string) => SerializedNode[];          // alias for querySelectorAll
}
```

### SerializedNode Interface

Each node returned from queries is a serialized representation:

```typescript
interface SerializedNode {
  // Identity
  _id: number;                    // Internal ID for node lookup
  tag: string;                    // Tag name (lowercase)

  // Content extraction
  text: string;                   // textContent (block-aware: preserves newlines from block elements)
  html: string;                   // innerHTML
  outerHtml: string;              // outerHTML

  // Attributes
  attr(name: string): string | null;           // Get attribute value
  attrs: Record<string, string>;               // All attributes as object
  dataAttr(name: string): string | null;       // Get data-* attribute (without prefix)
  dataAttrs: Record<string, string>;           // All data-* attributes

  // Classes
  classes: string[];                           // Array of class names
  hasClass(name: string): boolean;             // Check if class exists

  // Child queries (scoped to this element)
  querySelector(selector: string): SerializedNode | null;
  querySelectorAll(selector: string): SerializedNode[];
  $: (selector: string) => SerializedNode | null;
  $$: (selector: string) => SerializedNode[];

  // Traversal
  parent(selector?: string): SerializedNode | null;     // Parent, optionally matching selector
  closest(selector: string): SerializedNode | null;     // Closest ancestor matching selector
  children: SerializedNode[];                           // Direct children elements
  firstChild: SerializedNode | null;
  lastChild: SerializedNode | null;
  nextSibling: SerializedNode | null;                   // Next element sibling
  prevSibling: SerializedNode | null;                   // Previous element sibling
}
```

### Text Extraction (Block-Aware)

The `text` property normalizes whitespace but preserves semantic line breaks from block elements:

```html
<article>
  <h1>Title</h1>
  <p>First paragraph   with   spaces.</p>
  <p>Second paragraph.</p>
</article>
```

| Property | Output |
|----------|--------|
| `node.text` | `"Title\nFirst paragraph with spaces.\nSecond paragraph."` |
| `node.html` | Full innerHTML with tags |

**Block elements that insert newlines**: `p`, `div`, `h1`-`h6`, `li`, `tr`, `br`, `hr`, `article`, `section`, `header`, `footer`, `blockquote`, `pre`

**Normalization rules**:
1. Collapse multiple spaces/tabs within inline content to single space
2. Insert `\n` after block elements
3. Collapse multiple consecutive newlines to single newline
4. Trim leading/trailing whitespace

## Usage Examples

### Basic Queries

```javascript
// Get page title
(api, url) => api.$('title')?.text

// Get main heading
(api, url) => api.$('h1')?.text

// Get article content
(api, url) => api.$('article')?.html
```

### Attribute Access

```javascript
// Get canonical URL
(api, url) => api.$('link[rel="canonical"]')?.attr('href')

// Get all image sources
(api, url) => api.$$('img').map(img => img.attr('src'))

// Get data attributes
(api, url) => {
  const product = api.$('[data-product-id]');
  return {
    id: product?.dataAttr('product-id'),
    price: product?.dataAttr('price'),
    currency: product?.dataAttr('currency')
  };
}
```

### Child Queries (Scoped)

```javascript
// Find links within article only
(api, url) => {
  const article = api.$('article');
  return article?.$$('a').map(a => ({
    text: a.text,
    href: a.attr('href')
  }));
}

// Get structured data from a card
(api, url) => {
  const cards = api.$$('.product-card');
  return cards.map(card => ({
    title: card.$('h2')?.text,
    price: card.$('.price')?.text,
    image: card.$('img')?.attr('src'),
    link: card.$('a')?.attr('href')
  }));
}
```

### DOM Traversal

```javascript
// Find parent container
(api, url) => {
  const heading = api.$('h1');
  return heading?.closest('article')?.html;
}

// Navigate siblings
(api, url) => {
  const current = api.$('.active');
  return {
    prev: current?.prevSibling?.text,
    next: current?.nextSibling?.text
  };
}

// Get parent with specific class
(api, url) => {
  const price = api.$('.price');
  const card = price?.closest('.product-card');
  return card?.dataAttr('product-id');
}
```

### Complex Extraction

```javascript
// Blog post with metadata
(api, url) => {
  const article = api.$('article');
  return {
    title: article?.$('h1')?.text,
    author: article?.$('.author')?.text,
    date: article?.$('time')?.attr('datetime'),
    content: article?.$('.content')?.html,
    tags: article?.$$('.tag').map(t => t.text),
    relatedLinks: article?.$$('.related a').map(a => ({
      title: a.text,
      href: a.attr('href')
    }))
  };
}

// E-commerce product page
(api, url) => {
  const product = api.$('[itemtype*="Product"]') || api.$('.product');
  return {
    name: product?.$('[itemprop="name"]')?.text || product?.$('h1')?.text,
    price: product?.$('[itemprop="price"]')?.text || product?.$('.price')?.text,
    sku: product?.dataAttr('sku') || product?.$('[itemprop="sku"]')?.text,
    description: product?.$('[itemprop="description"]')?.html,
    images: product?.$$('img').map(img => img.attr('src')),
    inStock: product?.$('.stock')?.hasClass('in-stock'),
    rating: product?.$('.rating')?.dataAttr('value'),
    breadcrumbs: api.$$('.breadcrumb a').map(a => a.text)
  };
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure

1. Add linkedom dependency: `bun add linkedom`
2. Create `DOMBridge` class for host-side parsing
3. Implement node serialization
4. Update `runScopeFunction` to use new API

### Phase 2: Query Methods

1. Implement `querySelector` / `querySelectorAll`
2. Add `$` / `$$` shortcuts
3. Implement scoped child queries

### Phase 3: Node Properties

1. Implement block-aware text extraction
2. Add attribute methods (`attr`, `attrs`)
3. Add data attribute helpers (`dataAttr`, `dataAttrs`)
4. Add class helpers (`classes`, `hasClass`)

### Phase 4: Traversal

1. Implement child queries (`$`, `$$` on nodes)
2. Add `parent()` and `closest()` traversal
3. Add `children`, `firstChild`, `lastChild`
4. Add sibling navigation (`nextSibling`, `prevSibling`)

## Technical Details

### Host-Side Implementation

```typescript
// src/services/dom-bridge.ts
import { parseHTML } from "linkedom";

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

// Block elements that should insert newlines
const BLOCK_ELEMENTS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'tr', 'br', 'hr', 'article', 'section',
  'header', 'footer', 'blockquote', 'pre', 'ul', 'ol'
]);

export class DOMBridge {
  private document: Document;
  private nodeMap: Map<number, Element> = new Map();
  private nextId = 1;

  constructor(html: string) {
    const { document } = parseHTML(html);
    this.document = document;
  }

  querySelector(selector: string, context?: Element): SerializedNodeData | null {
    const el = (context || this.document).querySelector(selector);
    return el ? this.serializeNode(el) : null;
  }

  querySelectorAll(selector: string, context?: Element): SerializedNodeData[] {
    const elements = (context || this.document).querySelectorAll(selector);
    return Array.from(elements).map(el => this.serializeNode(el));
  }

  private serializeNode(element: Element): SerializedNodeData {
    const id = this.nextId++;
    this.nodeMap.set(id, element);

    return {
      _id: id,
      tag: element.tagName.toLowerCase(),
      text: this.extractBlockAwareText(element),
      html: element.innerHTML,
      outerHtml: element.outerHTML,
      attrs: this.getAttributes(element),
      dataAttrs: this.getDataAttributes(element),
      classes: Array.from(element.classList),
    };
  }

  private extractBlockAwareText(element: Element): string {
    const parts: string[] = [];

    const walk = (node: Node) => {
      if (node.nodeType === 3) { // Text node
        const text = node.textContent || '';
        parts.push(text.replace(/\s+/g, ' '));
      } else if (node.nodeType === 1) { // Element
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }

        if (BLOCK_ELEMENTS.has(tag)) {
          parts.push('\n');
        }
      }
    };

    walk(element);

    return parts
      .join('')
      .replace(/\n+/g, '\n')    // Collapse multiple newlines
      .replace(/ +/g, ' ')       // Collapse multiple spaces
      .trim();
  }

  private getAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  private getDataAttributes(element: Element): Record<string, string> {
    const dataAttrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        const key = attr.name.slice(5); // Remove 'data-' prefix
        dataAttrs[key] = attr.value;
      }
    }
    return dataAttrs;
  }

  // Methods for scoped queries (called via node IDs)
  childQuery(nodeId: number, selector: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element) return null;
    return this.querySelector(selector, element);
  }

  childQueryAll(nodeId: number, selector: string): SerializedNodeData[] {
    const element = this.nodeMap.get(nodeId);
    if (!element) return [];
    return this.querySelectorAll(selector, element);
  }

  closest(nodeId: number, selector: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element) return null;
    const result = element.closest(selector);
    return result ? this.serializeNode(result) : null;
  }

  parent(nodeId: number, selector?: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.parentElement) return null;
    if (selector) {
      return element.parentElement.matches(selector)
        ? this.serializeNode(element.parentElement)
        : null;
    }
    return this.serializeNode(element.parentElement);
  }

  children(nodeId: number): SerializedNodeData[] {
    const element = this.nodeMap.get(nodeId);
    if (!element) return [];
    return Array.from(element.children).map(el => this.serializeNode(el));
  }

  firstChild(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.firstElementChild) return null;
    return this.serializeNode(element.firstElementChild);
  }

  lastChild(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.lastElementChild) return null;
    return this.serializeNode(element.lastElementChild);
  }

  nextSibling(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.nextElementSibling) return null;
    return this.serializeNode(element.nextElementSibling);
  }

  prevSibling(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.previousElementSibling) return null;
    return this.serializeNode(element.previousElementSibling);
  }
}
```

### Sandbox-Side Code Generation

```typescript
// Generated code injected into sandbox
function generateSandboxCode(bridge: DOMBridge, html: string, url: string): string {
  return `
const __html = ${JSON.stringify(html)};
const __url = ${JSON.stringify(url)};

// Bridge call results are injected as __bridgeResults
// Each query populates this object with results

function createNode(data) {
  if (!data) return null;
  return {
    _id: data._id,
    tag: data.tag,
    text: data.text,
    html: data.html,
    outerHtml: data.outerHtml,
    attrs: data.attrs,
    dataAttrs: data.dataAttrs,
    classes: data.classes,

    attr(name) { return this.attrs[name] || null; },
    dataAttr(name) { return this.dataAttrs[name] || null; },
    hasClass(name) { return this.classes.includes(name); },

    // Child queries
    $(selector) { return createNode(__childQuery(this._id, selector)); },
    $$(selector) { return __childQueryAll(this._id, selector).map(createNode); },
    querySelector(s) { return this.$(s); },
    querySelectorAll(s) { return this.$$(s); },

    // Traversal
    closest(selector) { return createNode(__closest(this._id, selector)); },
    parent(selector) { return createNode(__parent(this._id, selector)); },
    get children() { return __children(this._id).map(createNode); },
    get firstChild() { return createNode(__firstChild(this._id)); },
    get lastChild() { return createNode(__lastChild(this._id)); },
    get nextSibling() { return createNode(__nextSibling(this._id)); },
    get prevSibling() { return createNode(__prevSibling(this._id)); },
  };
}

const api = {
  html: __html,
  url: __url,
  $(selector) { return createNode(__query(selector)); },
  $$(selector) { return __queryAll(selector).map(createNode); },
  querySelector(s) { return this.$(s); },
  querySelectorAll(s) { return this.$$(s); },
};
`;
}
```

## Limitations

- **No live DOM**: Nodes are serialized snapshots, not live references
- **No mutation**: Cannot modify the DOM (intentional for security)
- **Selector complexity**: Limited to what linkedom supports (most CSS3 selectors work)

## Dependencies

```bash
bun add linkedom
```

## Testing

1. Unit tests for DOMBridge class
2. Integration tests for sandbox execution
3. Block-aware text extraction tests
4. Complex selector compatibility tests
