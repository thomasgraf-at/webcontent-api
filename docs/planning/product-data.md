# Product Data Extraction

Extract structured product information from e-commerce pages.

## Overview

Product data extraction uses a multi-tier approach:
1. **Structured data** (JSON-LD, Microdata, RDFa) - most reliable
2. **Open Graph / Meta tags** - common fallback
3. **Common selectors** - pattern matching on known e-commerce patterns

---

## Request

```json
{
  "url": "https://example.com/product/widget",
  "options": {
    "data": {
      "product": true
    }
  }
}
```

With options:

```json
{
  "data": {
    "product": {
      "fallback": true,      // Use selector fallbacks (default: true)
      "currency": "USD",     // Normalize prices to currency
      "includeRaw": false    // Include raw extracted data
    }
  }
}
```

---

## Output

```typescript
interface ProductData {
  // Core fields
  name: string;
  description?: string;
  price?: {
    amount: number;
    currency: string;
    formatted: string;       // "€29.99"
  };

  // Pricing variants
  originalPrice?: Price;     // Before discount
  salePrice?: Price;
  priceRange?: {
    min: Price;
    max: Price;
  };

  // Availability
  availability?: "in_stock" | "out_of_stock" | "preorder" | "backorder" | "limited";
  quantity?: number;

  // Identifiers
  sku?: string;
  gtin?: string;             // UPC, EAN, ISBN
  mpn?: string;              // Manufacturer Part Number
  brand?: string;

  // Media
  images?: {
    url: string;
    alt?: string;
    primary?: boolean;
  }[];

  // Categorization
  category?: string[];       // Breadcrumb path
  tags?: string[];

  // Ratings
  rating?: {
    value: number;           // e.g., 4.5
    max: number;             // e.g., 5
    count: number;           // Number of reviews
  };

  // Variants
  variants?: {
    name: string;            // "Size", "Color"
    options: string[];       // ["S", "M", "L"] or ["Red", "Blue"]
    selected?: string;
  }[];

  // Seller
  seller?: {
    name: string;
    url?: string;
  };

  // Metadata
  url: string;
  extractedFrom: "json-ld" | "microdata" | "rdfa" | "opengraph" | "selectors" | "mixed";
  confidence: number;        // 0-1, how complete/reliable
}
```

---

## Extraction Tiers

### Tier 1: JSON-LD

Look for `<script type="application/ld+json">` with Product schema.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "description": "The best widget",
  "image": "https://example.com/widget.jpg",
  "sku": "WIDGET-001",
  "brand": {
    "@type": "Brand",
    "name": "WidgetCo"
  },
  "offers": {
    "@type": "Offer",
    "price": 29.99,
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.5,
    "reviewCount": 127
  }
}
</script>
```

**Parsing**:
```typescript
function extractJsonLd(doc: Document): ProductData | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '');

      // Handle @graph arrays
      const items = data['@graph'] || [data];

      for (const item of items) {
        if (item['@type'] === 'Product' ||
            item['@type']?.includes?.('Product')) {
          return parseSchemaProduct(item);
        }
      }
    } catch {}
  }

  return null;
}
```

---

### Tier 2: Microdata

Look for `itemtype="https://schema.org/Product"`.

```html
<div itemscope itemtype="https://schema.org/Product">
  <h1 itemprop="name">Widget Pro</h1>
  <img itemprop="image" src="/widget.jpg">
  <p itemprop="description">The best widget</p>
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <span itemprop="price" content="29.99">$29.99</span>
    <meta itemprop="priceCurrency" content="USD">
    <link itemprop="availability" href="https://schema.org/InStock">
  </div>
</div>
```

**Parsing**:
```typescript
function extractMicrodata(doc: Document): ProductData | null {
  const product = doc.querySelector('[itemtype*="schema.org/Product"]');
  if (!product) return null;

  return {
    name: getItemprop(product, 'name'),
    description: getItemprop(product, 'description'),
    price: parseOfferMicrodata(product.querySelector('[itemtype*="Offer"]')),
    // ...
  };
}

function getItemprop(scope: Element, prop: string): string | null {
  const el = scope.querySelector(`[itemprop="${prop}"]`);
  return el?.getAttribute('content') || el?.textContent?.trim() || null;
}
```

---

### Tier 3: RDFa

Look for `typeof="schema:Product"` or `vocab` declarations.

```html
<div vocab="https://schema.org/" typeof="Product">
  <span property="name">Widget Pro</span>
  <span property="offers" typeof="Offer">
    <span property="price" content="29.99">$29.99</span>
  </span>
</div>
```

---

### Tier 4: Open Graph

Fallback to Open Graph product tags.

```html
<meta property="og:type" content="product">
<meta property="og:title" content="Widget Pro">
<meta property="og:description" content="The best widget">
<meta property="og:image" content="https://example.com/widget.jpg">
<meta property="product:price:amount" content="29.99">
<meta property="product:price:currency" content="USD">
<meta property="product:availability" content="in stock">
```

**Parsing**:
```typescript
function extractOpenGraph(doc: Document): Partial<ProductData> | null {
  const type = doc.querySelector('meta[property="og:type"]')?.getAttribute('content');
  if (type !== 'product') return null;

  return {
    name: getMeta(doc, 'og:title'),
    description: getMeta(doc, 'og:description'),
    images: [{ url: getMeta(doc, 'og:image'), primary: true }],
    price: {
      amount: parseFloat(getMeta(doc, 'product:price:amount') || '0'),
      currency: getMeta(doc, 'product:price:currency') || 'USD',
    },
  };
}
```

---

### Tier 5: Common Selectors

Pattern matching for known e-commerce platforms and common conventions.

#### Platform-Specific Patterns

```typescript
const platformPatterns: Record<string, SelectorPattern> = {
  shopify: {
    detect: () => !!window.Shopify,
    name: '.product-single__title, .product__title, h1.title',
    price: '.product__price, .price__regular, [data-product-price]',
    originalPrice: '.price__compare, .compare-price, [data-compare-price]',
    description: '.product-single__description, .product__description',
    images: '.product__media img, .product-single__photo img',
    sku: '[data-sku]',
    availability: '[data-availability]',
  },

  woocommerce: {
    detect: () => doc.body.classList.contains('woocommerce'),
    name: '.product_title, h1.entry-title',
    price: '.woocommerce-Price-amount, .price ins .amount',
    originalPrice: '.price del .amount',
    description: '.woocommerce-product-details__short-description, .product-short-description',
    images: '.woocommerce-product-gallery__image img',
    sku: '.sku',
    availability: '.stock',
  },

  magento: {
    detect: () => !!doc.querySelector('[data-gallery-role]'),
    name: '.page-title span, h1.product-name',
    price: '.price-final_price .price, .regular-price .price',
    originalPrice: '.old-price .price',
    description: '.product.attribute.description .value',
    images: '.fotorama__img, .product-image-photo',
    sku: '.product.attribute.sku .value',
  },

  bigcommerce: {
    name: '.productView-title, h1[data-product-title]',
    price: '.productView-price [data-product-price]',
    description: '.productView-description',
    images: '.productView-image img',
  },

  amazon: {
    detect: () => location.hostname.includes('amazon'),
    name: '#productTitle',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice',
    originalPrice: '.a-text-strike, .priceBlockStrikePriceString',
    description: '#feature-bullets, #productDescription',
    images: '#imgTagWrapperId img, #landingImage',
    rating: '#acrPopover',
    ratingCount: '#acrCustomerReviewText',
  },
};
```

#### Generic Patterns

Fallback selectors for unknown platforms:

```typescript
const genericPatterns = {
  name: [
    'h1[class*="product"]',
    'h1[class*="title"]',
    '.product-name h1',
    '.product-title',
    '[data-product-name]',
    'h1',
  ],

  price: [
    '[class*="price"]:not([class*="old"]):not([class*="was"]):not([class*="original"])',
    '[data-price]',
    '[data-product-price]',
    '.current-price',
    '.sale-price',
    '.final-price',
  ],

  originalPrice: [
    '[class*="original-price"]',
    '[class*="was-price"]',
    '[class*="old-price"]',
    '[class*="compare-price"]',
    '.list-price',
    'del [class*="price"]',
    's [class*="price"]',
  ],

  description: [
    '[class*="product"][class*="description"]',
    '[data-product-description]',
    '.product-details',
    '.product-info',
  ],

  images: [
    '[class*="product"][class*="image"] img',
    '[class*="gallery"] img',
    '[data-product-image]',
    '.product-photo img',
  ],

  sku: [
    '[class*="sku"]',
    '[data-sku]',
    '[class*="product-id"]',
    '[class*="item-number"]',
  ],

  availability: [
    '[class*="availability"]',
    '[class*="stock"]',
    '[data-availability]',
    '.in-stock, .out-of-stock',
  ],

  rating: [
    '[class*="rating"][class*="value"]',
    '[data-rating]',
    '[class*="stars"]',
  ],

  brand: [
    '[class*="brand"]',
    '[data-brand]',
    '[itemprop="brand"]',
    'a[href*="/brand/"]',
  ],

  category: [
    '.breadcrumb a',
    '.breadcrumbs a',
    '[class*="breadcrumb"] a',
    'nav[aria-label="breadcrumb"] a',
  ],
};
```

---

## Price Parsing

Robust price extraction from various formats:

```typescript
function parsePrice(text: string, defaultCurrency = 'USD'): Price | null {
  if (!text) return null;

  // Clean the string
  const cleaned = text.trim();

  // Extract currency
  const currencyMatch = cleaned.match(/[$€£¥₹₽₩₪฿]/);
  const currencySymbols: Record<string, string> = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY',
    '₹': 'INR', '₽': 'RUB', '₩': 'KRW', '₪': 'ILS', '฿': 'THB',
  };

  let currency = defaultCurrency;
  if (currencyMatch) {
    currency = currencySymbols[currencyMatch[0]] || defaultCurrency;
  }

  // Also check for ISO codes
  const isoMatch = cleaned.match(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR)\b/i);
  if (isoMatch) {
    currency = isoMatch[1].toUpperCase();
  }

  // Extract numeric value
  // Handle formats: 1,234.56 | 1.234,56 | 1234.56 | 1234,56
  const numericPart = cleaned
    .replace(/[^0-9.,]/g, '')
    .replace(/,(\d{2})$/, '.$1')     // European format: 1.234,56 → 1234.56
    .replace(/,/g, '');               // Remove remaining commas

  const amount = parseFloat(numericPart);
  if (isNaN(amount)) return null;

  return {
    amount,
    currency,
    formatted: formatPrice(amount, currency),
  };
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

---

## Availability Mapping

Map various availability indicators to standard values:

```typescript
const availabilityPatterns: Record<string, RegExp[]> = {
  in_stock: [
    /in\s*stock/i,
    /available/i,
    /ready\s*to\s*ship/i,
    /add\s*to\s*cart/i,
    /buy\s*now/i,
    /schema\.org\/InStock/i,
  ],
  out_of_stock: [
    /out\s*of\s*stock/i,
    /sold\s*out/i,
    /unavailable/i,
    /currently\s*unavailable/i,
    /schema\.org\/OutOfStock/i,
  ],
  preorder: [
    /pre\s*-?\s*order/i,
    /coming\s*soon/i,
    /schema\.org\/PreOrder/i,
  ],
  backorder: [
    /back\s*-?\s*order/i,
    /ships?\s*in\s*\d+/i,
    /schema\.org\/BackOrder/i,
  ],
  limited: [
    /limited\s*(stock|availability|quantity)/i,
    /only\s*\d+\s*left/i,
    /low\s*stock/i,
    /schema\.org\/LimitedAvailability/i,
  ],
};

function parseAvailability(text: string): ProductData['availability'] {
  for (const [status, patterns] of Object.entries(availabilityPatterns)) {
    if (patterns.some(p => p.test(text))) {
      return status as ProductData['availability'];
    }
  }
  return undefined;
}
```

---

## Extraction Pipeline

```typescript
async function extractProduct(doc: Document, url: string): Promise<ProductData | null> {
  let result: Partial<ProductData> = { url };
  let source: ProductData['extractedFrom'] = 'selectors';

  // Tier 1: JSON-LD (highest priority)
  const jsonLd = extractJsonLd(doc);
  if (jsonLd) {
    result = { ...result, ...jsonLd };
    source = 'json-ld';
  }

  // Tier 2: Microdata
  if (!result.name) {
    const microdata = extractMicrodata(doc);
    if (microdata) {
      result = { ...result, ...microdata };
      source = result.name ? 'microdata' : source;
    }
  }

  // Tier 3: RDFa
  if (!result.name) {
    const rdfa = extractRdfa(doc);
    if (rdfa) {
      result = { ...result, ...rdfa };
      source = result.name ? 'rdfa' : source;
    }
  }

  // Tier 4: Open Graph
  const og = extractOpenGraph(doc);
  if (og) {
    // Fill gaps with OG data
    result = { ...og, ...result };
    if (!jsonLd && !result.name && og.name) {
      source = 'opengraph';
    }
  }

  // Tier 5: Selector fallbacks (fill remaining gaps)
  if (options.fallback !== false) {
    const selectors = extractFromSelectors(doc, url);
    result = fillGaps(result, selectors);

    if (source === 'selectors' && !jsonLd) {
      source = 'selectors';
    } else if (Object.keys(selectors).length > 0) {
      source = 'mixed';
    }
  }

  // Validate minimum data
  if (!result.name) {
    return null;
  }

  // Calculate confidence
  result.confidence = calculateConfidence(result, source);
  result.extractedFrom = source;

  return result as ProductData;
}

function calculateConfidence(data: Partial<ProductData>, source: string): number {
  let score = 0;
  const weights = {
    name: 0.2,
    price: 0.2,
    description: 0.1,
    images: 0.1,
    availability: 0.1,
    brand: 0.05,
    sku: 0.05,
    rating: 0.05,
    category: 0.05,
  };

  for (const [field, weight] of Object.entries(weights)) {
    if (data[field as keyof ProductData]) {
      score += weight;
    }
  }

  // Boost for structured data sources
  const sourceBonus = {
    'json-ld': 0.1,
    'microdata': 0.08,
    'rdfa': 0.08,
    'opengraph': 0.05,
    'selectors': 0,
    'mixed': 0.05,
  };

  score += sourceBonus[source] || 0;

  return Math.min(1, score);
}
```

---

## CLI Usage

```bash
# Extract product data
webcontent fetch https://example.com/product/widget --data product

# With raw data
webcontent fetch https://example.com/product/widget --data product --product-raw

# Specify currency normalization
webcontent fetch https://example.com/product/widget --data product --currency EUR
```

---

## Response Example

```json
{
  "url": "https://example.com/product/widget",
  "response": {
    "title": "Widget Pro - Example Store",
    "content": "..."
  },
  "data": {
    "product": {
      "name": "Widget Pro",
      "description": "The best widget for all your widget needs.",
      "price": {
        "amount": 29.99,
        "currency": "USD",
        "formatted": "$29.99"
      },
      "originalPrice": {
        "amount": 39.99,
        "currency": "USD",
        "formatted": "$39.99"
      },
      "availability": "in_stock",
      "sku": "WIDGET-001",
      "brand": "WidgetCo",
      "images": [
        {
          "url": "https://example.com/images/widget-1.jpg",
          "primary": true
        },
        {
          "url": "https://example.com/images/widget-2.jpg"
        }
      ],
      "category": ["Home", "Tools", "Widgets"],
      "rating": {
        "value": 4.5,
        "max": 5,
        "count": 127
      },
      "variants": [
        {
          "name": "Size",
          "options": ["Small", "Medium", "Large"],
          "selected": "Medium"
        },
        {
          "name": "Color",
          "options": ["Red", "Blue", "Green"]
        }
      ],
      "url": "https://example.com/product/widget",
      "extractedFrom": "json-ld",
      "confidence": 0.95
    }
  }
}
```

---

## Priority

1. **Phase 1**: JSON-LD and Microdata extraction
2. **Phase 2**: Open Graph fallback
3. **Phase 3**: Platform-specific selectors (Shopify, WooCommerce, etc.)
4. **Phase 4**: Generic selector patterns
5. **Phase 5**: Price normalization and currency conversion

---

## Related

- [plugins.md](./plugins.md) - Product as a data plugin
- [site-rules.md](./site-rules.md) - Custom product extraction rules per site
- [enrichment.md](./enrichment.md) - Combine with company/pricing APIs
