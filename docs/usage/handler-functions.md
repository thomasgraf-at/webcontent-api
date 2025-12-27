# Handler Functions Guide

Handler functions allow custom JavaScript extraction logic in a sandboxed environment. They're useful for extracting structured data, transforming content, or handling site-specific layouts.

## Table of Contents

- [Basic Syntax](#basic-syntax)
- [DOM API](#dom-api)
  - [Query Methods](#query-methods)
  - [Node Properties](#node-properties)
  - [Node Methods](#node-methods)
  - [Node Traversal](#node-traversal)
  - [Supported Selectors](#supported-selectors)
- [Common Patterns](#common-patterns)
- [Return Values](#return-values)
- [Security Restrictions](#security-restrictions)
- [CLI Examples](#cli-examples)
- [API Examples](#api-examples)
- [Debugging Tips](#debugging-tips)
- [When to Use Handler Functions](#when-to-use-handler-functions)

## Basic Syntax

Functions must be arrow functions or function expressions that receive two parameters:

```javascript
(api, url) => { /* extraction logic */ }

// or

function(api, url) { /* extraction logic */ }
```

- `api` - DOM query API object for HTML extraction
- `url` - The page URL (string)

## DOM API

Handler functions execute in a sandboxed QuickJS/WASM environment without direct DOM access. The `api` object provides a jQuery-like interface for querying and traversing HTML content safely.

The API is designed to be:
- **Familiar**: Uses `$()` and `$$()` syntax similar to jQuery and browser DevTools
- **Safe**: Runs in an isolated sandbox with no network or filesystem access
- **Portable**: Can be reused across different projects implementing the same interface
- **Expressive**: Supports full CSS selectors, scoped queries, and DOM traversal

### Query Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `api.$(selector)` | `Node \| null` | First matching element |
| `api.$$(selector)` | `Node[]` | All matching elements |
| `api.querySelector(selector)` | `Node \| null` | Alias for `$()` |
| `api.querySelectorAll(selector)` | `Node[]` | Alias for `$$()` |
| `api.html` | `string` | Raw HTML string |
| `api.url` | `string` | Page URL |

### Node Properties

| Property | Type | Description |
|----------|------|-------------|
| `node.text` | `string` | Text content (block-aware, normalized) |
| `node.html` | `string` | innerHTML |
| `node.outerHtml` | `string` | outerHTML |
| `node.tag` | `string` | Tag name (lowercase) |
| `node.attrs` | `object` | All attributes |
| `node.dataAttrs` | `object` | All data-* attributes |
| `node.classes` | `string[]` | Array of class names |

### Node Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `node.attr(name)` | `string \| null` | Get attribute value |
| `node.dataAttr(name)` | `string \| null` | Get data-* attribute (without prefix) |
| `node.hasClass(name)` | `boolean` | Check if class exists |
| `node.$(selector)` | `Node \| null` | Query within this element |
| `node.$$(selector)` | `Node[]` | Query all within this element |
| `node.closest(selector)` | `Node \| null` | Find closest ancestor |
| `node.parent(selector?)` | `Node \| null` | Get parent, optionally matching selector |

### Node Traversal

| Property | Type | Description |
|----------|------|-------------|
| `node.children` | `Node[]` | Direct child elements |
| `node.firstChild` | `Node \| null` | First child element |
| `node.lastChild` | `Node \| null` | Last child element |
| `node.nextSibling` | `Node \| null` | Next sibling element |
| `node.prevSibling` | `Node \| null` | Previous sibling element |

### Supported Selectors

Full CSS selector support including:
- Tag names: `h1`, `p`, `article`, `div`
- Classes: `.content`, `.article-body`
- IDs: `#main`, `#content`
- Attributes: `[data-id]`, `[href^="https://"]`
- Combinators: `article h1`, `.post > p`, `h1 + p`
- Pseudo-classes: `:first-child`, `:last-child`, `:nth-child(2)`

## Common Patterns

### Extract Page Title

```javascript
(api, url) => api.$('title')?.text
```

### Extract Main Heading

```javascript
(api, url) => api.$('h1')?.text
```

### Extract Article Content

```javascript
(api, url) => api.$('article')?.html
```

### Extract Multiple Sections

```javascript
(api, url) => {
  const article = api.$('article');
  return {
    title: article?.$('h1')?.text,
    content: article?.$('.content')?.html,
    author: article?.$('.author-name')?.text
  };
}
```

### Extract All Paragraphs

```javascript
(api, url) => api.$$('p').map(p => p.text).join('\n\n')
```

### Extract Links with Attributes

```javascript
(api, url) => api.$$('a').map(a => ({
  text: a.text,
  href: a.attr('href')
}))
```

### Extract Data Attributes

```javascript
(api, url) => {
  const product = api.$('[data-product-id]');
  return {
    id: product?.dataAttr('product-id'),
    price: product?.dataAttr('price'),
    currency: product?.dataAttr('currency')
  };
}
```

### Scoped Queries

```javascript
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
(api, url) => {
  const price = api.$('.price');
  const card = price?.closest('.product-card');
  return {
    productId: card?.dataAttr('product-id'),
    price: price?.text
  };
}

// Sibling navigation
(api, url) => {
  const current = api.$('.active');
  return {
    prev: current?.prevSibling?.text,
    next: current?.nextSibling?.text
  };
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

## Return Values

Functions can return:

- **String**: Returned as `content` directly
- **Object**: JSON-stringified and returned as `content`

```javascript
// Returns string content
(api, url) => api.$('h1')?.text

// Returns JSON object
(api, url) => ({ title: api.$('h1')?.text, url })
```

## Security Restrictions

Functions run in a sandboxed QuickJS/WASM environment with these restrictions:

| Feature | Status | Notes |
|---------|--------|-------|
| Network (fetch) | Blocked | Cannot make HTTP requests |
| File system | Blocked | Cannot read/write files |
| Timers | Disabled | setTimeout/setInterval are no-ops |
| Global state | Isolated | No state persists between executions |
| Execution time | Limited | Default 5s, max 60s (configurable) |

## CLI Examples

```bash
# Simple text extraction
webcontent fetch https://example.com -s '{"type":"function","code":"(api, url) => api.$(\"h1\")?.text"}'

# Structured extraction
webcontent fetch https://example.com -s '{"type":"function","code":"(api, url) => ({ title: api.$(\"h1\")?.text, links: api.$$(\"a\").map(a => a.attr(\"href\")) })"}'

# Using scoped queries
webcontent fetch https://example.com -s '{"type":"function","code":"(api, url) => api.$$(\"article\").map(a => ({ title: a.$(\"h1\")?.text, content: a.html }))"}'
```

## API Examples

```json
{
  "url": "https://example.com",
  "options": {
    "scope": {
      "type": "function",
      "code": "(api, url) => ({ title: api.$('h1')?.text, paragraphs: api.$$('p').map(p => p.text) })",
      "timeout": 10000
    },
    "format": "html"
  }
}
```

## Debugging Tips

1. **Start simple**: Test with `(api, url) => api.html.length` to verify the function runs
2. **Check selectors**: Use `api.$$('*').length` to see how many elements exist
3. **Log structure**: Return `{ debug: true, html: api.html.slice(0, 500) }` to inspect HTML
4. **Test locally**: Use the test HTML page at `/tests/fetch.html` with function scope

## When to Use Handler Functions

Use handler functions when:
- You need custom extraction logic not covered by `main`/`full`/`selector`
- You want to return structured JSON data
- You need to transform or clean content
- Site-specific handling is required
- You need complex CSS selectors or DOM traversal

Consider alternatives:
- **Selector scope**: For simple CSS-based extraction without custom logic
- **Data plugins**: For standard extractions like headings, links (when available)
- **Main scope**: For general article extraction with automatic cleanup
