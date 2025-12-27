# Handler API Proposals

> **Status**: Planning

Proposals for additional sandbox-compatible APIs that could extend handler function capabilities.

## Current State

Handler functions currently have:
- DOM query API (`api.$`, `api.$$`)
- Node properties and traversal
- Raw HTML and URL access

## Proposal 1: URL Utilities

URL parsing and manipulation utilities for handler functions.

### Use Cases
- Extract query parameters from URLs
- Parse path segments
- Normalize URLs for comparison
- Build relative URLs

### API Design

```typescript
interface URLUtils {
  // Parse URL into components
  parse(url: string): ParsedURL;

  // Get query parameter
  param(name: string): string | null;

  // Get all query parameters
  params(): Record<string, string>;

  // Get path segments
  segments(): string[];

  // Check if URL matches pattern
  matches(pattern: string): boolean;
}

interface ParsedURL {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
}
```

### Example Usage

```javascript
(api, url) => {
  const parsed = api.url.parse(url);
  const page = api.url.param('page');
  const segments = api.url.segments();

  return {
    domain: parsed.hostname,
    category: segments[0],
    productId: segments[1],
    page: page ? parseInt(page) : 1
  };
}
```

### Implementation Notes
- Use native URL parsing on host side
- Serialize results for sandbox
- No network access, purely string manipulation

---

## Proposal 2: Text Processing

Text normalization and extraction utilities.

### Use Cases
- Clean and normalize extracted text
- Extract dates, prices, numbers
- Truncate content with word boundaries
- Strip HTML from strings

### API Design

```typescript
interface TextUtils {
  // Normalize whitespace
  normalize(text: string): string;

  // Strip HTML tags
  stripHtml(html: string): string;

  // Truncate with word boundary
  truncate(text: string, maxLength: number, suffix?: string): string;

  // Extract first match of pattern
  extract(text: string, pattern: RegExp): string | null;

  // Extract all matches
  extractAll(text: string, pattern: RegExp): string[];

  // Parse number from text (handles currency, commas, etc.)
  parseNumber(text: string): number | null;

  // Parse date from text
  parseDate(text: string): string | null; // ISO format
}
```

### Example Usage

```javascript
(api, url) => {
  const priceText = api.$('.price')?.text;
  const description = api.$('.description')?.html;

  return {
    price: api.text.parseNumber(priceText),
    summary: api.text.truncate(api.text.stripHtml(description), 200, '...'),
    sku: api.text.extract(priceText, /SKU:\s*(\w+)/)?.[1]
  };
}
```

### Implementation Notes
- Regex operations in sandbox (QuickJS supports RegExp)
- Number/date parsing on host for locale handling
- Consider including common patterns as constants

---

## Proposal 3: JSON-LD / Structured Data

Extract and parse structured data from pages.

### Use Cases
- Extract Schema.org data
- Parse JSON-LD blocks
- Access microdata
- Get product/article/event data

### API Design

```typescript
interface StructuredData {
  // Get all JSON-LD objects
  jsonld(): object[];

  // Get JSON-LD by @type
  jsonldByType(type: string): object | null;

  // Get microdata by itemtype
  microdata(itemtype?: string): object[];

  // Get Open Graph data (already in meta, but convenient here)
  opengraph(): Record<string, string>;

  // Get Twitter card data
  twitter(): Record<string, string>;
}
```

### Example Usage

```javascript
(api, url) => {
  const product = api.structured.jsonldByType('Product');
  const article = api.structured.jsonldByType('Article');

  if (product) {
    return {
      name: product.name,
      price: product.offers?.price,
      currency: product.offers?.priceCurrency,
      availability: product.offers?.availability
    };
  }

  if (article) {
    return {
      headline: article.headline,
      author: article.author?.name,
      published: article.datePublished
    };
  }

  return null;
}
```

### Implementation Notes
- Parse JSON-LD scripts on host side
- Validate against basic Schema.org types
- Handle malformed JSON gracefully

---

## Proposal 4: Table Extraction

Structured table data extraction.

### Use Cases
- Extract tabular data as arrays/objects
- Handle header rows
- Parse data tables
- Export comparison tables

### API Design

```typescript
interface TableUtils {
  // Parse table element to array of rows
  parse(selector: string): string[][];

  // Parse with first row as headers
  parseWithHeaders(selector: string): Record<string, string>[];

  // Get specific cell
  cell(selector: string, row: number, col: number): string | null;
}
```

### Example Usage

```javascript
(api, url) => {
  // Parse pricing table with headers
  const pricing = api.table.parseWithHeaders('.pricing-table');

  // Returns: [{ Plan: 'Basic', Price: '$9/mo', Features: '...' }, ...]
  return {
    plans: pricing.map(row => ({
      name: row['Plan'],
      price: api.text.parseNumber(row['Price']),
      features: row['Features']?.split(',').map(f => f.trim())
    }))
  };
}
```

### Implementation Notes
- Handle rowspan/colspan
- Normalize cell content
- Support multiple tables

---

## Proposal 5: List Extraction

Extract and structure list data.

### Use Cases
- Parse navigation menus
- Extract bullet point lists
- Handle nested lists
- Get breadcrumb data

### API Design

```typescript
interface ListUtils {
  // Parse list to flat array
  items(selector: string): string[];

  // Parse nested list to tree structure
  tree(selector: string): ListNode[];

  // Parse as links (text + href)
  links(selector: string): Array<{ text: string; href: string }>;
}

interface ListNode {
  text: string;
  href?: string;
  children?: ListNode[];
}
```

### Example Usage

```javascript
(api, url) => {
  const nav = api.list.tree('nav ul');
  const breadcrumbs = api.list.links('.breadcrumb');

  return {
    navigation: nav,
    breadcrumbs: breadcrumbs.map(b => b.text),
    path: breadcrumbs.map(b => b.href)
  };
}
```

---

## Proposal 6: Form Data Extraction

Extract form structure and options.

### Use Cases
- Extract search form parameters
- Get select/dropdown options
- Understand form structure
- Extract hidden fields

### API Design

```typescript
interface FormUtils {
  // Get all form fields
  fields(selector: string): FormField[];

  // Get select options
  options(selector: string): Array<{ value: string; text: string }>;

  // Get form action and method
  info(selector: string): { action: string; method: string };
}

interface FormField {
  name: string;
  type: string;
  value?: string;
  required?: boolean;
  options?: Array<{ value: string; text: string }>;
}
```

### Example Usage

```javascript
(api, url) => {
  const searchForm = api.form.info('#search-form');
  const categories = api.form.options('#category-select');

  return {
    searchEndpoint: searchForm.action,
    categories: categories.map(c => c.text)
  };
}
```

---

## Implementation Priority

| Proposal | Priority | Complexity | Value |
|----------|----------|------------|-------|
| URL Utilities | High | Low | High - common need |
| Text Processing | High | Medium | High - very useful |
| Structured Data | Medium | Medium | High - rich data |
| Table Extraction | Medium | High | Medium - specific use |
| List Extraction | Low | Medium | Medium - DOM covers most |
| Form Data | Low | Medium | Low - niche use |

## Security Considerations

All proposed APIs must:
- Not enable network access
- Not enable file system access
- Not enable code evaluation
- Be purely data extraction/transformation
- Execute within timeout limits
- Produce serializable output

## Next Steps

1. Gather feedback on proposals
2. Prioritize based on user needs
3. Design detailed interfaces
4. Implement incrementally
5. Document in handler-apis.md
