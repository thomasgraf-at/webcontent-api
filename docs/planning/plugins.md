# Data Plugins Roadmap

This document outlines the data plugin system and planned plugins for WebContent.

## Overview

Data plugins extend WebContent's extraction capabilities beyond the core `meta` and `content` fields. They are requested via the `data` parameter and output structured data under `response.data`.

## Plugin Categories

### 1. Structure Extraction
Plugins that extract structural elements from HTML.

### 2. Content Analysis
Plugins that analyze and derive insights from content.

### 3. External Integration
Plugins that integrate with external services (AI, APIs).

---

## Built-in Plugins

### `headings` - Heading Extraction

**Status**: Available

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
  text: string;   // Text content
}
// Returns: Heading[]
```

**Example**:
```json
{
  "data": { "headings": { "minLevel": 1, "maxLevel": 3 } }
}
// Output:
{
  "data": {
    "headings": [
      { "level": 1, "text": "Main Title" },
      { "level": 2, "text": "Introduction" },
      { "level": 2, "text": "Features" }
    ]
  }
}
```

---

### `links` - Link Extraction

**Status**: Planned

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

### `images` - Image Extraction

**Status**: Planned

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

### `words` - Word Analysis

**Status**: Planned

Analyze word frequency and content statistics.

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

### `tables` - Table Extraction

**Status**: Planned

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

## Advanced Plugins

### `seo` - SEO Analysis

**Status**: Planned

Comprehensive SEO analysis of the page.

**Output**:
```typescript
interface SeoAnalysis {
  score: number;
  issues: SeoIssue[];
  suggestions: string[];
}
interface SeoIssue {
  type: "error" | "warning" | "info";
  message: string;
  element?: string;
}
```

**Checks**:
- Title length and presence
- Meta description length
- Heading hierarchy (single H1, logical order)
- Image alt text coverage
- Internal/external link ratio
- Mobile viewport meta
- Canonical URL presence

---

### `schema` - Structured Data Extraction

**Status**: Planned

Extract JSON-LD and microdata from the page.

**Output**:
```typescript
interface SchemaData {
  jsonLd: object[];
  microdata: object[];
}
```

---

### `feeds` - Feed Detection

**Status**: Planned

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

## External Integration Plugins

These plugins require external services or API keys.

### `summary` - AI Summary

**Status**: Planned

Generate an AI-powered summary of the content.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | "haiku" | AI model to use |
| `maxLength` | number | 200 | Maximum summary length |
| `style` | string | "neutral" | Summary style |

**Output**:
```typescript
interface Summary {
  text: string;
  model: string;
}
```

---

### `entities` - Entity Extraction

**Status**: Planned

Extract named entities (people, companies, locations) using NLP.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `types` | string[] | ["person", "org", "location"] | Entity types |

**Output**:
```typescript
interface Entity {
  type: string;
  text: string;
  count: number;
}
// Returns: Entity[]
```

---

### `sentiment` - Sentiment Analysis

**Status**: Planned

Analyze the sentiment of the content.

**Output**:
```typescript
interface Sentiment {
  score: number;      // -1 to 1
  label: "negative" | "neutral" | "positive";
  confidence: number;
}
```

---

### `translate` - Translation

**Status**: Planned

Translate content to a target language.

**Options**:
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | string | required | Target language code |
| `source` | string | "auto" | Source language |

**Output**:
```typescript
interface Translation {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}
```

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

1. **Pure functions**: Plugins should not have side effects
2. **Error handling**: Throw descriptive errors for invalid options
3. **Performance**: Avoid parsing HTML multiple times if possible
4. **Documentation**: Include options table and output type

### Registration

Add to `src/plugins/index.ts`:

```typescript
import { myPlugin } from "./my-plugin";

export const plugins = {
  // ... existing
  myPlugin,
};
```

---

## Priority Roadmap

1. **Phase 1** (Current): `headings`
2. **Phase 2**: `links`, `images`
3. **Phase 3**: `words`, `tables`, `seo`
4. **Phase 4**: `schema`, `feeds`
5. **Phase 5**: External integrations (`summary`, `entities`)
