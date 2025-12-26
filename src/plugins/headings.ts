import { parse } from "node-html-parser";
import type { DataPlugin } from "./types";

export interface HeadingsOptions {
  minLevel?: number;
  maxLevel?: number;
}

export interface Heading {
  level: number;
  text: string;
}

export const headingsPlugin: DataPlugin<HeadingsOptions, Heading[]> = {
  name: "headings",
  description: "Extract heading hierarchy (h1-h6)",

  execute(html: string, options: HeadingsOptions = {}): Heading[] {
    const minLevel = options.minLevel ?? 1;
    const maxLevel = options.maxLevel ?? 6;

    if (minLevel < 1 || minLevel > 6) {
      throw new Error("minLevel must be between 1 and 6");
    }
    if (maxLevel < 1 || maxLevel > 6) {
      throw new Error("maxLevel must be between 1 and 6");
    }
    if (minLevel > maxLevel) {
      throw new Error("minLevel cannot be greater than maxLevel");
    }

    const root = parse(html);
    const headings: Heading[] = [];

    for (let level = minLevel; level <= maxLevel; level++) {
      const elements = root.querySelectorAll(`h${level}`);
      for (const el of elements) {
        const text = el.textContent?.trim();
        if (text) {
          headings.push({ level, text });
        }
      }
    }

    // Sort by document order (querySelectorAll returns in document order per level,
    // but we queried level by level, so we need to re-sort)
    // Since node-html-parser doesn't expose position, we'll re-query all at once
    const allHeadings: Heading[] = [];
    const selectors = [];
    for (let level = minLevel; level <= maxLevel; level++) {
      selectors.push(`h${level}`);
    }

    const allElements = root.querySelectorAll(selectors.join(", "));
    for (const el of allElements) {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.substring(1), 10);
      const text = el.textContent?.trim();
      if (text && level >= minLevel && level <= maxLevel) {
        allHeadings.push({ level, text });
      }
    }

    return allHeadings;
  },
};
