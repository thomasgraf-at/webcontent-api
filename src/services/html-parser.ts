import { parse, HTMLElement } from "node-html-parser";
import TurndownService from "turndown";
import {
  type Scope,
  type ScopeResolution,
  type SelectorScope,
  type FunctionScope,
  isSelectorScope,
  isFunctionScope,
} from "./scope";
import { runScopeFunction } from "./sandbox";

export type ContentFormat = "html" | "markdown" | "text";

export interface OpenGraph {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
  siteName: string | null;
}

export interface HreflangLink {
  lang: string;
  url: string;
}

export interface PageMeta {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonical: string | null;
  robots: string | null;
  index: boolean;
  heading: string | null;
  hreflang: HreflangLink[];
  opengraph: OpenGraph;
}

export function parseHtmlMeta(html: string): PageMeta {
  const root = parse(html);

  const robots = getMetaContent(root, "robots");
  const index = !robots?.toLowerCase().includes("noindex");

  return {
    title: getTitle(root),
    description: getMetaContent(root, "description"),
    keywords: getMetaContent(root, "keywords"),
    canonical: getCanonical(root),
    robots,
    index,
    heading: getFirstHeading(root),
    hreflang: getHreflang(root),
    opengraph: getOpenGraph(root),
  };
}

function getTitle(root: HTMLElement): string | null {
  const titleEl = root.querySelector("title");
  return titleEl?.textContent?.trim() || null;
}

function getMetaContent(root: HTMLElement, name: string): string | null {
  const meta = root.querySelector(`meta[name="${name}"]`);
  return meta?.getAttribute("content") || null;
}

function getOgContent(root: HTMLElement, property: string): string | null {
  const meta = root.querySelector(`meta[property="${property}"]`);
  return meta?.getAttribute("content") || null;
}

function getCanonical(root: HTMLElement): string | null {
  const link = root.querySelector('link[rel="canonical"]');
  return link?.getAttribute("href") || null;
}

function getFirstHeading(root: HTMLElement): string | null {
  const h1 = root.querySelector("h1");
  return h1?.textContent?.trim() || null;
}

function getHreflang(root: HTMLElement): HreflangLink[] {
  const links = root.querySelectorAll('link[rel="alternate"][hreflang]');
  return links
    .map((link) => {
      const lang = link.getAttribute("hreflang");
      const url = link.getAttribute("href");
      if (lang && url) {
        return { lang, url };
      }
      return null;
    })
    .filter((item): item is HreflangLink => item !== null);
}

function getOpenGraph(root: HTMLElement): OpenGraph {
  return {
    title: getOgContent(root, "og:title"),
    description: getOgContent(root, "og:description"),
    image: getOgContent(root, "og:image"),
    url: getOgContent(root, "og:url"),
    type: getOgContent(root, "og:type"),
    siteName: getOgContent(root, "og:site_name"),
  };
}

export function extractContent(
  html: string,
  mainOnly: boolean,
  format: ContentFormat
): string {
  const root = parse(html);

  // Always remove these elements
  const alwaysRemove = ["script", "style", "noscript", "iframe", "svg"];
  alwaysRemove.forEach((tag) => {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Remove images with data: URIs
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src?.startsWith("data:")) {
      img.remove();
    }
  });

  // Elements to remove for main content only
  if (mainOnly) {
    const mainOnlyRemove = [
      "nav",
      "header",
      "footer",
      "aside",
      "form",
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '[role="complementary"]',
      ".nav",
      ".navbar",
      ".header",
      ".footer",
      ".sidebar",
      ".menu",
      ".advertisement",
      ".ads",
      ".ad",
      "#nav",
      "#header",
      "#footer",
      "#sidebar",
      "#menu",
    ];
    mainOnlyRemove.forEach((selector) => {
      root.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  // Get content container
  let content: HTMLElement | null = null;

  if (mainOnly) {
    const mainSelectors = [
      "main",
      '[role="main"]',
      "article",
      ".content",
      ".post",
      ".article",
      ".entry",
      "#content",
      "#main",
      ".main",
    ];

    for (const selector of mainSelectors) {
      const el = root.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length >= 100) {
        content = el;
        break;
      }
    }
  }

  if (!content) {
    content = root.querySelector("body") || root;
  }

  const innerHTML = content.innerHTML;

  switch (format) {
    case "html":
      return innerHTML;
    case "markdown":
      return convertToMarkdown(innerHTML);
    case "text":
      return cleanText(content.textContent || "");
  }
}

function convertToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  turndownService.addRule("removeEmptyLinks", {
    filter: (node) => {
      return (
        node.nodeName === "A" &&
        (!node.textContent || node.textContent.trim() === "")
      );
    },
    replacement: () => "",
  });

  return turndownService.turndown(html).trim();
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Result of extraction with scope
 */
export interface ExtractionResult {
  content: string;
  scopeResolution: ScopeResolution;
}

/**
 * Extract content using selector-based scope.
 * Finds all elements matching include selectors, removes elements matching exclude selectors.
 */
export function extractBySelector(
  html: string,
  scope: SelectorScope,
  format: ContentFormat
): string {
  const root = parse(html);

  // Always remove these elements first
  const alwaysRemove = ["script", "style", "noscript", "iframe", "svg"];
  alwaysRemove.forEach((tag) => {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  });

  // Remove images with data: URIs
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src?.startsWith("data:")) {
      img.remove();
    }
  });

  // Find all elements matching include selectors (deduplicated)
  const elementSet = new Set<HTMLElement>();
  for (const selector of scope.include) {
    const matches = root.querySelectorAll(selector);
    matches.forEach((el) => elementSet.add(el));
  }
  const elements = Array.from(elementSet);

  // Remove excluded elements from each matched element
  if (scope.exclude && scope.exclude.length > 0) {
    for (const el of elements) {
      for (const excludeSelector of scope.exclude) {
        el.querySelectorAll(excludeSelector).forEach((e) => e.remove());
      }
    }
  }

  // Combine content from all matched elements
  const combinedHtml = elements.map((el) => el.innerHTML).join("\n");

  switch (format) {
    case "html":
      return combinedHtml;
    case "markdown":
      return convertToMarkdown(combinedHtml);
    case "text":
      return cleanText(elements.map((el) => el.textContent || "").join("\n"));
  }
}

/**
 * Extract content using a scope configuration.
 * This is the main entry point for scope-based extraction.
 */
export async function extractWithScope(
  html: string,
  scope: Scope,
  format: ContentFormat,
  url?: string
): Promise<ExtractionResult> {
  // Handle "auto" scope - for now falls back to "main"
  // TODO: Integrate with site handlers database when available
  if (scope === "auto") {
    const content = extractContent(html, true, format);
    return {
      content,
      scopeResolution: {
        scopeUsed: "main",
        scopeResolved: true,
      },
    };
  }

  // Handle simple string scopes
  if (scope === "main" || scope === "full") {
    const content = extractContent(html, scope === "main", format);
    return {
      content,
      scopeResolution: {
        scopeUsed: scope,
        scopeResolved: false,
      },
    };
  }

  // Handle selector scope
  if (isSelectorScope(scope)) {
    const content = extractBySelector(html, scope, format);
    return {
      content,
      scopeResolution: {
        scopeUsed: scope,
        scopeResolved: false,
      },
    };
  }

  // Handle function scope
  if (isFunctionScope(scope)) {
    const content = await extractByFunction(html, scope, format, url || "");
    return {
      content,
      scopeResolution: {
        scopeUsed: scope,
        scopeResolved: false,
      },
    };
  }

  // Handle handler scope
  if (scope.type === "handler") {
    // TODO: Integrate with site handlers database
    throw new Error(
      `Handler scope "${scope.id}" not yet implemented. Site handlers database required.`
    );
  }

  // Should never reach here if types are correct
  throw new Error(`Unknown scope type`);
}

/** Custom error class for function scope validation/execution errors */
export class FunctionScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FunctionScopeError";
  }
}

/**
 * Extract content using a custom JavaScript function.
 * The function runs in a sandboxed QuickJS environment.
 */
async function extractByFunction(
  html: string,
  scope: FunctionScope,
  format: ContentFormat,
  url: string
): Promise<string> {
  const result = await runScopeFunction(scope.code, html, url, {
    timeout: scope.timeout ?? 5000,
  });

  if (!result.ok) {
    throw new FunctionScopeError(result.error || "Function execution failed");
  }

  // Convert the result to the requested format
  let content: string;

  if (typeof result.data === "string") {
    content = result.data;
  } else if (typeof result.data === "object" && result.data !== null) {
    // If the function returned an object, stringify it for JSON-like output
    content = JSON.stringify(result.data, null, 2);
  } else {
    content = String(result.data ?? "");
  }

  // If the content looks like HTML and format is markdown/text, convert it
  if (content.includes("<") && content.includes(">")) {
    switch (format) {
      case "html":
        return content;
      case "markdown":
        return convertToMarkdown(content);
      case "text":
        return cleanText(content.replace(/<[^>]+>/g, " "));
    }
  }

  return content;
}
