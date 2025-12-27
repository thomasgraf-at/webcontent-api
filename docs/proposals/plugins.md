# Data Plugins

Data plugins extend WebContent's extraction capabilities beyond the core `meta` and `content` fields.

## Overview

Plugins are requested via `options.data` and output to `response.data`.

```json
{
  "options": {
    "data": {
      "headings": { "minLevel": 1, "maxLevel": 3 },
      "links": true
    }
  }
}
```

```json
{
  "response": {
    "data": {
      "headings": [...],
      "links": {...}
    }
  }
}
```

---

## Available Plugins

### `headings`

**Status**: Implemented

Extract all headings from the page with their hierarchy.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minLevel` | number | 1 | Minimum heading level (1-6) |
| `maxLevel` | number | 6 | Maximum heading level (1-6) |

**Output**:
```typescript
interface Heading {
  level: number;  // 1-6
  text: string;
}
// Returns: Heading[]
```

---

## Planned Plugins

### `links`

Extract all links from the page, categorized by type.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `internal` | boolean | true | Include internal links |
| `external` | boolean | true | Include external links |
| `anchors` | boolean | false | Include anchor-only links (#) |

**Output**:
```typescript
interface LinkData {
  internal: Link[];
  external: Link[];
  anchors?: Link[];
}
interface Link {
  href: string;
  text: string;
}
```

---

### `images`

Extract all images from the page.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeDataUri` | boolean | false | Include data: URI images |
| `includeSvg` | boolean | false | Include inline SVGs |

**Output**:
```typescript
interface Image {
  src: string;
  alt: string | null;
  width?: number;
  height?: number;
}
// Returns: Image[]
```

---

### `tables`

Extract HTML tables as structured data.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | string | "array" | Output format: "array" or "objects" |
| `headerRow` | boolean | true | First row is header |

**Output**:
```typescript
interface Table {
  headers?: string[];
  rows: (string[] | Record<string, string>)[];
}
// Returns: Table[]
```

---

### `schema`

Extract JSON-LD and microdata from the page.

**Output**:
```typescript
interface SchemaData {
  jsonLd: object[];
  microdata: object[];
}
```

---

### `feeds`

Detect RSS/Atom feeds linked from the page.

**Output**:
```typescript
interface Feed {
  type: "rss" | "atom";
  url: string;
  title?: string;
}
// Returns: Feed[]
```

---

## Analysis Plugins

### `words`

Word frequency and content statistics.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `limit` | number | 100 | Max words to return |
| `minLength` | number | 3 | Minimum word length |
| `stopwords` | boolean | true | Filter common stopwords |

**Output**:
```typescript
interface WordAnalysis {
  total: number;
  unique: number;
  frequency: { word: string; count: number }[];
}
```

---

### `seo`

SEO analysis of the page.

**Output**:
```typescript
interface SeoAnalysis {
  score: number;
  issues: SeoIssue[];
  suggestions: string[];
}
```

**Checks**:
- Title length and presence
- Meta description
- Heading hierarchy
- Image alt text
- Internal/external link ratio

---

## External Integration Plugins

These require external services or API keys.

### `summary`

AI-powered content summary.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | "haiku" | AI model |
| `maxLength` | number | 200 | Max summary length |

---

### `entities`

Named entity extraction (people, companies, locations).

---

### `sentiment`

Sentiment analysis of the content.

---

## Plugin Development

### Interface

```typescript
interface DataPlugin<TOptions = unknown, TOutput = unknown> {
  name: string;
  description: string;
  execute(html: string, options: TOptions): TOutput | Promise<TOutput>;
}
```

### Guidelines

1. **Pure functions**: No side effects
2. **Error handling**: Throw descriptive errors
3. **Performance**: Avoid parsing HTML multiple times
4. **Documentation**: Include options table and output type

### Registration

Add to `src/plugins/index.ts`:

```typescript
import { myPlugin } from "./my-plugin";

export const plugins = {
  // existing...
  myPlugin,
};
```

---

## Roadmap

1. **Phase 1** (Done): `headings`
2. **Phase 2**: `links`, `images`
3. **Phase 3**: `tables`, `schema`, `feeds`
4. **Phase 4**: `words`, `seo`
5. **Phase 5**: External integrations
