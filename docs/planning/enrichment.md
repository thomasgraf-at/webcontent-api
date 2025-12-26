# Data Enrichment

Public data sources that can be fetched alongside or independently of page content.

## Overview

Enrichment data provides additional context about a URL/domain beyond the page content itself. Can be requested via plugins or separate endpoints.

---

## Tier 1: No External API Required

### robots.txt

Parse robots.txt for crawl rules and sitemap locations.

```json
{
  "data": {
    "robots": true
  }
}
```

**Output**:
```typescript
interface RobotsData {
  exists: boolean;
  sitemaps: string[];
  rules: {
    userAgent: string;
    allow: string[];
    disallow: string[];
    crawlDelay?: number;
  }[];
}
```

---

### sitemap.xml

Parse sitemap(s) for URL list and metadata.

```json
{
  "data": {
    "sitemap": true
  }
}
```

**Output**:
```typescript
interface SitemapData {
  urls: {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
  }[];
  count: number;
  // For sitemap index files
  sitemaps?: string[];
}
```

**Options**:
- `limit`: Max URLs to return (default: 1000)
- `url`: Specific sitemap URL (default: auto-detect from robots.txt or /sitemap.xml)

---

### Security Headers

Analyze HTTP response headers for security configuration.

```json
{
  "data": {
    "securityHeaders": true
  }
}
```

**Output**:
```typescript
interface SecurityHeadersData {
  score: number;  // 0-100
  headers: {
    "Strict-Transport-Security"?: { present: boolean; value?: string; valid: boolean };
    "Content-Security-Policy"?: { present: boolean; value?: string; valid: boolean };
    "X-Frame-Options"?: { present: boolean; value?: string; valid: boolean };
    "X-Content-Type-Options"?: { present: boolean; value?: string; valid: boolean };
    "Referrer-Policy"?: { present: boolean; value?: string; valid: boolean };
    "Permissions-Policy"?: { present: boolean; value?: string; valid: boolean };
  };
  missing: string[];
  recommendations: string[];
}
```

---

### DNS Records

Lookup DNS records for the domain.

```json
{
  "data": {
    "dns": true
  }
}
```

**Output**:
```typescript
interface DnsData {
  a: string[];      // IPv4
  aaaa: string[];   // IPv6
  mx: { priority: number; host: string }[];
  txt: string[];
  ns: string[];
  cname?: string;
}
```

---

### SSL Certificate

Extract SSL/TLS certificate information.

```json
{
  "data": {
    "ssl": true
  }
}
```

**Output**:
```typescript
interface SslData {
  valid: boolean;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  san: string[];  // Subject Alternative Names
  protocol: string;
  cipher: string;
}
```

---

### Technology Detection

Detect technologies used (CMS, frameworks, analytics, etc.).

Pattern matching on HTML, headers, cookies, and scripts.

```json
{
  "data": {
    "tech": true
  }
}
```

**Output**:
```typescript
interface TechData {
  cms?: string[];        // WordPress, Drupal, etc.
  frameworks?: string[]; // React, Vue, Angular, etc.
  analytics?: string[];  // Google Analytics, Plausible, etc.
  cdn?: string[];        // Cloudflare, Fastly, etc.
  server?: string;       // nginx, Apache, etc.
  hosting?: string;      // AWS, Vercel, Netlify, etc.
  ecommerce?: string[];  // Shopify, WooCommerce, etc.
}
```

**Implementation**: Use patterns similar to Wappalyzer (open source).

---

### Well-Known Files

Check for common well-known files.

```json
{
  "data": {
    "wellKnown": true
  }
}
```

**Output**:
```typescript
interface WellKnownData {
  "security.txt"?: { exists: boolean; contact?: string; expires?: string };
  "humans.txt"?: { exists: boolean; content?: string };
  "ads.txt"?: { exists: boolean };
  "app-ads.txt"?: { exists: boolean };
  "assetlinks.json"?: { exists: boolean };  // Android
  "apple-app-site-association"?: { exists: boolean };  // iOS
}
```

---

### Favicon

Extract favicon URL and metadata.

```json
{
  "data": {
    "favicon": true
  }
}
```

**Output**:
```typescript
interface FaviconData {
  url: string;
  type: string;  // ico, png, svg
  sizes?: string[];
  appleTouchIcon?: string;
}
```

---

## Tier 2: Free External APIs

### Wayback Machine

Check Internet Archive availability.

```json
{
  "data": {
    "wayback": true
  }
}
```

**Output**:
```typescript
interface WaybackData {
  available: boolean;
  firstSnapshot?: string;  // ISO date
  lastSnapshot?: string;
  snapshotCount?: number;
  closestUrl?: string;  // Link to archived version
}
```

**API**: `https://archive.org/wayback/available?url=...`

---

### Hacker News Mentions

Find HN submissions for the URL/domain.

```json
{
  "data": {
    "hn": true
  }
}
```

**Output**:
```typescript
interface HnData {
  submissions: {
    id: number;
    title: string;
    points: number;
    comments: number;
    date: string;
    url: string;
  }[];
  totalHits: number;
}
```

**API**: Algolia HN Search API (free, no key required)

---

### Reddit Mentions

Find Reddit submissions for the URL.

```json
{
  "data": {
    "reddit": true
  }
}
```

**Output**:
```typescript
interface RedditData {
  submissions: {
    subreddit: string;
    title: string;
    score: number;
    comments: number;
    date: string;
    url: string;
  }[];
}
```

**API**: Reddit search (rate limited without auth)

---

## Tier 3: API Key Required

### WHOIS

Domain registration information.

```json
{
  "data": {
    "whois": true
  }
}
```

**Output**:
```typescript
interface WhoisData {
  registrar: string;
  createdDate: string;
  expiresDate: string;
  updatedDate: string;
  nameservers: string[];
  status: string[];
  domainAge: number;  // days
}
```

**APIs**: WhoisXML, WHOIS API, etc.

---

### Google Safe Browsing

Check URL against malware/phishing lists.

```json
{
  "data": {
    "safeBrowsing": true
  }
}
```

**Output**:
```typescript
interface SafeBrowsingData {
  safe: boolean;
  threats: {
    type: string;  // MALWARE, SOCIAL_ENGINEERING, etc.
    platform: string;
  }[];
}
```

**API**: Google Safe Browsing API (free tier available)

---

### PageSpeed / Lighthouse

Performance and quality scores.

```json
{
  "data": {
    "lighthouse": true
  }
}
```

**Output**:
```typescript
interface LighthouseData {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
}
```

**API**: PageSpeed Insights API (free with API key)

---

## Tier 4: Paid APIs (Affordable)

Commercial APIs with reasonable pricing for low-to-medium volume usage.

### BuiltWith

Comprehensive technology profiling.

```json
{
  "data": {
    "builtwith": true
  }
}
```

**Output**:
```typescript
interface BuiltWithData {
  technologies: {
    name: string;
    category: string;
    firstDetected?: string;
    lastDetected?: string;
  }[];
  spend?: string;  // Estimated tech spend tier
  verticals?: string[];
}
```

**API**: [BuiltWith](https://builtwith.com/api) - From $295/mo for 500 lookups

**Notes**: More comprehensive than self-hosted Wappalyzer patterns.

---

### SimilarWeb

Traffic and engagement estimates.

```json
{
  "data": {
    "traffic": true
  }
}
```

**Output**:
```typescript
interface TrafficData {
  globalRank?: number;
  countryRank?: { country: string; rank: number };
  monthlyVisits?: number;
  avgVisitDuration?: number;  // seconds
  pagesPerVisit?: number;
  bounceRate?: number;
  topCountries?: { country: string; share: number }[];
  trafficSources?: {
    direct: number;
    referral: number;
    search: number;
    social: number;
    mail: number;
    paid: number;
  };
}
```

**API**: [SimilarWeb](https://www.similarweb.com/corp/developer/) - From $200/mo

**Alternatives**:
- [Semrush API](https://www.semrush.com/api/) - Similar data, $119/mo+
- [Ahrefs API](https://ahrefs.com/api) - SEO focused, $500/mo+

---

### Clearbit

Company and domain enrichment.

```json
{
  "data": {
    "company": true
  }
}
```

**Output**:
```typescript
interface CompanyData {
  name: string;
  legalName?: string;
  domain: string;
  description?: string;
  founded?: number;
  location?: {
    city: string;
    state: string;
    country: string;
  };
  employees?: number;
  employeesRange?: string;
  industry?: string;
  subIndustry?: string;
  tags?: string[];
  techStack?: string[];
  socialProfiles?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
  };
  logo?: string;
}
```

**API**: [Clearbit](https://clearbit.com/) - Pay per lookup, ~$0.20-0.50/lookup

**Alternatives**:
- [Apollo.io](https://www.apollo.io/api) - Similar data, lower cost
- [Hunter.io](https://hunter.io/api) - Email finding focused, $49/mo for 1000 requests

---

### ScrapingBee / Browserless

Headless browser as a service (for JS rendering).

```json
{
  "options": {
    "render": true,
    "renderProvider": "scrapingbee"
  }
}
```

**Output**: Rendered HTML passed to normal extraction pipeline.

**APIs**:
- [ScrapingBee](https://www.scrapingbee.com/) - $49/mo for 150k credits
- [Browserless](https://www.browserless.io/) - $50/mo for 10k sessions
- [Apify](https://apify.com/) - Pay per compute, ~$0.25/1000 pages

**Use case**: Fallback when local Puppeteer/Playwright isn't available (e.g., Cloud Run without headless Chrome).

---

### Diffbot

Automatic structured data extraction.

```json
{
  "data": {
    "diffbot": true
  }
}
```

**Output**:
```typescript
interface DiffbotData {
  type: "article" | "product" | "discussion" | "image" | "video";
  // For articles:
  title?: string;
  author?: string;
  date?: string;
  text?: string;
  images?: string[];
  // For products:
  productName?: string;
  price?: string;
  availability?: string;
  // etc.
}
```

**API**: [Diffbot](https://www.diffbot.com/) - $299/mo for 10k pages

**Notes**: Alternative to building custom site rules. Returns structured JSON automatically.

---

### URLScan.io

Security analysis and screenshot.

```json
{
  "data": {
    "urlscan": true
  }
}
```

**Output**:
```typescript
interface UrlscanData {
  score: number;  // 0-100 threat score
  malicious: boolean;
  categories: string[];
  screenshot?: string;  // URL to screenshot
  effectiveUrl: string;  // After redirects
  ips: string[];
  asn: { number: number; name: string }[];
  certificates: { issuer: string; validTo: string }[];
  technologies: string[];
}
```

**API**: [URLScan.io](https://urlscan.io/docs/api/) - Free tier (50/day), paid from $60/mo

---

### IPinfo / IPdata

IP geolocation and ASN data.

```json
{
  "data": {
    "ipinfo": true
  }
}
```

**Output**:
```typescript
interface IpInfoData {
  ip: string;
  hostname?: string;
  city?: string;
  region?: string;
  country: string;
  org?: string;  // ISP/Organization
  asn?: {
    number: number;
    name: string;
    domain: string;
    type: string;  // isp, hosting, business, education
  };
  privacy?: {
    vpn: boolean;
    proxy: boolean;
    tor: boolean;
    hosting: boolean;
  };
}
```

**APIs**:
- [IPinfo](https://ipinfo.io/) - Free tier (50k/mo), $99/mo for 250k
- [IPdata](https://ipdata.co/) - Free tier (1.5k/day), $10/mo for 25k

---

### Carbon / Website Carbon

Environmental impact estimate.

```json
{
  "data": {
    "carbon": true
  }
}
```

**Output**:
```typescript
interface CarbonData {
  bytes: number;
  cleanerThan: number;  // Percentage (0-100)
  green: boolean;  // Green hosted
  co2: {
    grid: number;  // grams per pageview
    renewable: number;
  };
}
```

**API**: [Website Carbon](https://api.websitecarbon.com/) - Free tier, paid for volume

---

## Pricing Summary

| Service | Free Tier | Paid Starting |
|---------|-----------|---------------|
| BuiltWith | No | $295/mo |
| SimilarWeb | Limited | $200/mo |
| Clearbit | No | ~$0.20/lookup |
| ScrapingBee | 1k credits | $49/mo |
| Browserless | 500 sessions | $50/mo |
| Diffbot | Trial | $299/mo |
| URLScan.io | 50/day | $60/mo |
| IPinfo | 50k/mo | $99/mo |
| Website Carbon | Yes | Volume pricing |

---

## Implementation

### As Plugins

Most enrichment can be implemented as data plugins:

```json
{
  "url": "https://example.com",
  "options": {
    "data": {
      "robots": true,
      "dns": true,
      "tech": true
    }
  }
}
```

### As Standalone Endpoint

For domain-level data (not tied to a specific page):

```
GET /domain/example.com
POST /domain
{
  "domain": "example.com",
  "data": ["dns", "whois", "ssl"]
}
```

**Response**:
```json
{
  "domain": "example.com",
  "data": {
    "dns": { ... },
    "whois": { ... },
    "ssl": { ... }
  }
}
```

### Caching

Enrichment data should be cached separately from page content:
- DNS/SSL: Cache for 1 hour
- robots.txt/sitemap: Cache for 1 day
- WHOIS: Cache for 1 week
- Wayback: Cache for 1 day

---

## Priority

1. **Phase 1**: robots.txt, sitemap, security headers, favicon
2. **Phase 2**: DNS, SSL, tech detection
3. **Phase 3**: Wayback, HN, well-known files
4. **Phase 4**: WHOIS, Safe Browsing, Lighthouse (free API keys)
5. **Phase 5**: Paid APIs (based on demand/use case)

---

## Related

- [plugins.md](./plugins.md) - Plugin system for data extraction
- [site-rules.md](./site-rules.md) - Site-specific rules can use enrichment data
