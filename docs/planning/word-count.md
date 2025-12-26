# Intelligent Word Count

Advanced word counting with stopword filtering, positional weighting, and term rarity scoring.

## Overview

Beyond simple word counts, provide weighted and normalized metrics that better represent content value and uniqueness.

---

## Basic Word Count

```json
{
  "options": {
    "include": ["wordCount"]
  }
}
```

**Output**:
```typescript
interface WordCountData {
  total: number;           // All words
  unique: number;          // Unique words
  filtered: number;        // After stopword removal
  uniqueFiltered: number;  // Unique after stopwords
}
```

---

## Stopword Filtering

Remove common words that add little semantic value.

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "stopwords": true,        // Use default stopword list
      "language": "en"          // Language for stopwords (default: auto-detect)
    }
  }
}
```

### Stopword Lists

Built-in lists for common languages:
- English (~175 words): the, a, an, is, are, was, were, be, been, being...
- German (~230 words): der, die, das, ein, eine, ist, sind, war...
- French (~160 words): le, la, les, un, une, est, sont, été...
- Spanish (~180 words): el, la, los, las, un, una, es, son...

**Source**: Use established lists like NLTK, Snowball, or ISO stopwords.

### Custom Stopwords

```json
{
  "wordCount": {
    "stopwords": ["click", "subscribe", "newsletter"],
    "addStopwords": ["custom", "words"],
    "removeStopwords": ["not", "no"]  // Keep these even if in default list
  }
}
```

---

## Positional Weighting

Weight words by their location in the document.

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "weighted": true
    }
  }
}
```

### Default Weights

| Position | Weight | Rationale |
|----------|--------|-----------|
| Title (`<title>`) | 3.0 | Primary identifier |
| H1 | 2.5 | Main heading |
| H2 | 2.0 | Section headings |
| H3-H6 | 1.5 | Subheadings |
| Meta description | 2.0 | SEO summary |
| Meta keywords | 1.5 | Explicit keywords |
| Bold/Strong | 1.2 | Emphasized text |
| Italic/Em | 1.1 | Emphasized text |
| Links (anchor text) | 1.3 | Navigation/reference |
| Alt text | 1.2 | Image descriptions |
| Body text | 1.0 | Base weight |

### Custom Weights

```json
{
  "wordCount": {
    "weighted": true,
    "weights": {
      "title": 5.0,
      "h1": 3.0,
      "h2": 2.0,
      "meta.description": 2.5,
      "body": 1.0
    }
  }
}
```

### Weighted Output

```typescript
interface WeightedWordCountData extends WordCountData {
  weightedTotal: number;      // Sum of all weights
  weightedUnique: number;     // Weighted unique words
  topWeighted: {
    word: string;
    count: number;
    weight: number;
    weightedScore: number;    // count * weight
  }[];
}
```

---

## Term Frequency (TF)

How often each word appears in the document.

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "tf": true,
      "tfLimit": 50
    }
  }
}
```

**Output**:
```typescript
interface TfData {
  terms: {
    word: string;
    count: number;
    tf: number;           // count / total words
    tfNormalized: number; // 0-1 normalized
  }[];
}
```

### TF Variants

- **Raw TF**: `count / totalWords`
- **Log TF**: `1 + log(count)` (reduces impact of high-frequency terms)
- **Augmented TF**: `0.5 + 0.5 * (count / maxCount)` (normalized by max term frequency)

```json
{
  "wordCount": {
    "tf": "log"  // "raw" | "log" | "augmented"
  }
}
```

---

## Inverse Document Frequency (IDF)

Weight words by how rare they are across a corpus of documents.

### Corpus Database

Maintain a database of word frequencies from crawled pages:

```sql
CREATE TABLE word_frequencies (
  word TEXT PRIMARY KEY,
  document_count INTEGER NOT NULL,    -- How many docs contain this word
  total_count INTEGER NOT NULL,       -- Total occurrences across all docs
  last_updated INTEGER NOT NULL
);

CREATE TABLE corpus_stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
-- Keys: total_documents, last_computed
```

### IDF Calculation

```
IDF(word) = log(N / df(word))
```

Where:
- `N` = total documents in corpus
- `df(word)` = number of documents containing the word

**Smoothed IDF** (handles unseen words):
```
IDF(word) = log((N + 1) / (df(word) + 1)) + 1
```

### IDF Request

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "idf": true
    }
  }
}
```

**Output**:
```typescript
interface IdfData {
  terms: {
    word: string;
    count: number;
    df: number;           // Document frequency
    idf: number;          // Inverse document frequency
    rarity: "common" | "uncommon" | "rare" | "unique";
  }[];
  corpusSize: number;     // Total docs in corpus
}
```

### Rarity Thresholds

| Rarity | Document Frequency |
|--------|-------------------|
| common | > 50% of docs |
| uncommon | 10-50% of docs |
| rare | 1-10% of docs |
| unique | < 1% of docs |

---

## TF-IDF

Combine term frequency and inverse document frequency for relevance scoring.

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "tfidf": true,
      "tfidfLimit": 30
    }
  }
}
```

**Calculation**:
```
TF-IDF(word, doc) = TF(word, doc) * IDF(word)
```

**Output**:
```typescript
interface TfIdfData {
  terms: {
    word: string;
    count: number;
    tf: number;
    idf: number;
    tfidf: number;
  }[];
  // Top terms by TF-IDF score represent the document's "signature"
  signature: string[];  // Top 10 distinctive terms
}
```

### Use Cases

- **Content fingerprinting**: Identify document by its distinctive terms
- **Duplicate detection**: Similar TF-IDF profiles suggest similar content
- **Topic extraction**: High TF-IDF terms indicate main topics
- **SEO analysis**: Find what makes a page unique

---

## Corpus Management

### Building the Corpus

The corpus builds automatically from fetched pages:

```typescript
interface CorpusConfig {
  enabled: boolean;
  minDocuments: number;      // Min docs before IDF is meaningful (default: 100)
  updateFrequency: string;   // How often to recalculate (default: "1d")
  sampleRate: number;        // Fraction of pages to include (default: 1.0)
  excludeDomains?: string[]; // Domains to exclude from corpus
}
```

### Corpus Endpoints

```
GET /corpus/stats
{
  "totalDocuments": 15000,
  "totalWords": 2500000,
  "uniqueWords": 450000,
  "lastUpdated": "2024-01-15T12:00:00Z"
}

GET /corpus/word/:word
{
  "word": "javascript",
  "documentCount": 3500,
  "totalCount": 12000,
  "idf": 1.46,
  "rarity": "uncommon"
}

GET /corpus/top?limit=100&sort=frequency
GET /corpus/top?limit=100&sort=rarity
```

### Pre-built Corpus

Option to use pre-built corpus instead of building from scratch:

- **General web corpus**: Based on Common Crawl data
- **Domain-specific**: Tech, news, academic, etc.

```json
{
  "wordCount": {
    "corpus": "general-web"  // or "tech", "news", custom
  }
}
```

---

## Full Response

Complete word analysis with all features:

```json
{
  "options": {
    "include": ["wordCount"],
    "wordCount": {
      "stopwords": true,
      "weighted": true,
      "tfidf": true,
      "limit": 50
    }
  }
}
```

**Response**:
```typescript
interface FullWordCountData {
  // Basic counts
  total: number;
  unique: number;
  filtered: number;
  uniqueFiltered: number;

  // Weighted totals
  weightedTotal: number;

  // Term analysis
  terms: {
    word: string;
    count: number;
    positions: ("title" | "h1" | "h2" | "body" | "meta")[];
    weight: number;
    tf: number;
    idf: number;
    tfidf: number;
    rarity: "common" | "uncommon" | "rare" | "unique";
  }[];

  // Summary
  signature: string[];          // Top distinctive terms
  readingTime: number;          // Estimated minutes
  lexicalDiversity: number;     // unique/total ratio (0-1)
  averageWordLength: number;
}
```

---

## CLI Usage

```bash
# Basic word count
webcontent fetch https://example.com --include wordCount

# With stopwords filtered
webcontent fetch https://example.com --include wordCount --stopwords

# Weighted analysis
webcontent fetch https://example.com --include wordCount --weighted

# Full TF-IDF analysis
webcontent fetch https://example.com --include wordCount --tfidf --limit 30

# Corpus stats
webcontent corpus stats
webcontent corpus word "javascript"
webcontent corpus top --limit 50 --sort rarity
```

---

## Implementation

### Word Extraction

```typescript
interface WordExtractor {
  extract(html: string): ExtractedWord[];
}

interface ExtractedWord {
  word: string;
  position: Position;
  context: string;  // Surrounding text
}

type Position =
  | { type: "title" }
  | { type: "meta"; name: string }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: "body"; tag?: string }
  | { type: "link" }
  | { type: "alt" };
```

### Word Normalization

1. Convert to lowercase
2. Remove punctuation (keep hyphens in compounds)
3. Normalize unicode (NFD → NFC)
4. Optionally stem (Porter, Snowball)

```json
{
  "wordCount": {
    "normalize": true,
    "stem": "porter",      // "porter" | "snowball" | false
    "minLength": 2,        // Ignore single chars
    "maxLength": 50        // Ignore very long strings
  }
}
```

### Performance

- Word extraction: O(n) where n = document length
- Stopword filtering: O(w) where w = word count (hash set lookup)
- TF calculation: O(w)
- IDF lookup: O(u) where u = unique words (database query)

For large documents (>100k words), consider:
- Streaming extraction
- Batched IDF lookups
- Caching normalized word lists

---

## Priority

1. **Phase 1**: Basic word count with stopwords
2. **Phase 2**: Positional weighting
3. **Phase 3**: Term frequency (TF)
4. **Phase 4**: Corpus database and IDF
5. **Phase 5**: Full TF-IDF with signature extraction

---

## Related

- [plugins.md](./plugins.md) - Word count as a data plugin
- [enrichment.md](./enrichment.md) - Part of content analysis enrichment
