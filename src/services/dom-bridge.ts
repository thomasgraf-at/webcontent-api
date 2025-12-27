/**
 * DOM Bridge for Sandbox Functions
 * Provides host-side HTML parsing with linkedom and exposes serialized
 * query/traversal methods for use in the QuickJS sandbox.
 */

import { parseHTML } from "linkedom";

/** Serialized node data passed to sandbox */
export interface SerializedNodeData {
  _id: number;
  tag: string;
  text: string;
  html: string;
  outerHtml: string;
  attrs: Record<string, string>;
  dataAttrs: Record<string, string>;
  classes: string[];
}

/** Block elements that insert newlines in text extraction */
const BLOCK_ELEMENTS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "tr",
  "br",
  "hr",
  "article",
  "section",
  "header",
  "footer",
  "blockquote",
  "pre",
  "ul",
  "ol",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "nav",
  "aside",
  "main",
  "figure",
  "figcaption",
  "address",
  "dd",
  "dt",
  "dl",
]);

/**
 * DOMBridge parses HTML on the host side and provides methods
 * for querying and traversing the DOM. Results are serialized
 * for use in the QuickJS sandbox.
 */
export class DOMBridge {
  private document: Document;
  private nodeMap: Map<number, Element> = new Map();
  private nextId = 1;

  constructor(html: string) {
    const { document } = parseHTML(html);
    this.document = document;
  }

  /** Query for first matching element */
  querySelector(
    selector: string,
    context?: Element
  ): SerializedNodeData | null {
    try {
      const el = (context || this.document).querySelector(selector);
      return el ? this.serializeNode(el as Element) : null;
    } catch {
      return null; // Invalid selector
    }
  }

  /** Query for all matching elements */
  querySelectorAll(
    selector: string,
    context?: Element
  ): SerializedNodeData[] {
    try {
      const elements = (context || this.document).querySelectorAll(selector);
      return Array.from(elements).map((el) => this.serializeNode(el as Element));
    } catch {
      return []; // Invalid selector
    }
  }

  /** Scoped child query */
  childQuery(nodeId: number, selector: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element) return null;
    return this.querySelector(selector, element);
  }

  /** Scoped child query all */
  childQueryAll(nodeId: number, selector: string): SerializedNodeData[] {
    const element = this.nodeMap.get(nodeId);
    if (!element) return [];
    return this.querySelectorAll(selector, element);
  }

  /** Find closest ancestor matching selector */
  closest(nodeId: number, selector: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element) return null;
    try {
      const result = element.closest(selector);
      return result ? this.serializeNode(result as Element) : null;
    } catch {
      return null;
    }
  }

  /** Get parent element, optionally matching selector */
  parent(nodeId: number, selector?: string): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.parentElement) return null;

    if (selector) {
      try {
        return element.parentElement.matches(selector)
          ? this.serializeNode(element.parentElement)
          : null;
      } catch {
        return null;
      }
    }
    return this.serializeNode(element.parentElement);
  }

  /** Get all direct children */
  children(nodeId: number): SerializedNodeData[] {
    const element = this.nodeMap.get(nodeId);
    if (!element) return [];
    return Array.from(element.children).map((el) => this.serializeNode(el as Element));
  }

  /** Get first child element */
  firstChild(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.firstElementChild) return null;
    return this.serializeNode(element.firstElementChild as Element);
  }

  /** Get last child element */
  lastChild(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.lastElementChild) return null;
    return this.serializeNode(element.lastElementChild as Element);
  }

  /** Get next sibling element */
  nextSibling(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.nextElementSibling) return null;
    return this.serializeNode(element.nextElementSibling as Element);
  }

  /** Get previous sibling element */
  prevSibling(nodeId: number): SerializedNodeData | null {
    const element = this.nodeMap.get(nodeId);
    if (!element || !element.previousElementSibling) return null;
    return this.serializeNode(element.previousElementSibling as Element);
  }

  /** Serialize an element to data that can be passed to sandbox */
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

  /**
   * Extract text content with block-aware newlines.
   * Collapses inline whitespace but preserves newlines from block elements.
   */
  private extractBlockAwareText(element: Element): string {
    const parts: string[] = [];

    const walk = (node: Node) => {
      if (node.nodeType === 3) {
        // Text node
        const text = node.textContent || "";
        parts.push(text.replace(/\s+/g, " "));
      } else if (node.nodeType === 1) {
        // Element node
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // Handle br specially - insert newline before processing children
        if (tag === "br") {
          parts.push("\n");
          return;
        }

        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }

        if (BLOCK_ELEMENTS.has(tag)) {
          parts.push("\n");
        }
      }
    };

    walk(element);

    return parts
      .join("")
      .replace(/\n+/g, "\n") // Collapse multiple newlines
      .replace(/ +/g, " ") // Collapse multiple spaces
      .replace(/ \n/g, "\n") // Remove space before newline
      .replace(/\n /g, "\n") // Remove space after newline
      .trim();
  }

  /** Get all attributes as a record */
  private getAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /** Get data-* attributes with prefix removed */
  private getDataAttributes(element: Element): Record<string, string> {
    const dataAttrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith("data-")) {
        const key = attr.name.slice(5); // Remove 'data-' prefix
        dataAttrs[key] = attr.value;
      }
    }
    return dataAttrs;
  }
}
