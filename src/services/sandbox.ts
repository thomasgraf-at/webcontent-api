/**
 * QuickJS Sandbox Service
 * Provides isolated JavaScript execution for function scope extraction.
 * Uses WebAssembly-based QuickJS for secure sandboxing.
 */

import { loadQuickJs, type SandboxOptions } from "@sebastianwessel/quickjs";
// @ts-ignore - wasm variant import
import variant from "@jitl/quickjs-ng-wasmfile-release-sync";

/** Result of sandbox execution */
export interface SandboxResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Options for sandbox execution */
export interface SandboxExecOptions {
  /** Maximum execution time in milliseconds */
  timeout?: number;
}

// Cached QuickJS runtime loader
let quickJsLoader: ReturnType<typeof loadQuickJs> | null = null;

/**
 * Get or create the QuickJS runtime loader.
 * The loader is cached for performance.
 */
async function getQuickJs() {
  if (!quickJsLoader) {
    quickJsLoader = loadQuickJs(variant);
  }
  return quickJsLoader;
}

/**
 * Run JavaScript code in a sandboxed environment.
 *
 * The code has access to:
 * - Standard JavaScript APIs (String, Array, Object, JSON, Math, RegExp, etc.)
 * - A `parseHTML` function for DOM parsing
 *
 * The code does NOT have access to:
 * - File system
 * - Network (fetch)
 * - Timers (setTimeout, setInterval)
 * - Global state between executions
 *
 * @param code - JavaScript code to execute (should export default a value)
 * @param options - Execution options
 * @returns Result with data or error
 */
export async function runInSandbox(
  code: string,
  options: SandboxExecOptions = {}
): Promise<SandboxResult> {
  const { timeout = 5000 } = options;

  try {
    const { runSandboxed } = await getQuickJs();

    const sandboxOptions: SandboxOptions = {
      // Disable all external capabilities for security
      allowFetch: false,
      allowFs: false,
      // Set execution timeout
      executionTimeout: timeout,
      // No environment variables
      env: {},
    };

    const result = await runSandboxed(async ({ evalCode }) => {
      return await evalCode(code);
    }, sandboxOptions);

    if (result.ok) {
      return { ok: true, data: result.data };
    } else {
      return {
        ok: false,
        error: result.error?.message || "Sandbox execution failed",
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown sandbox error",
    };
  }
}

/**
 * Validate function code syntax before execution.
 * Returns an error message if invalid, null if valid.
 */
function validateFunctionSyntax(code: string): string | null {
  const trimmed = code.trim();

  // Must start with a function expression pattern
  const validPatterns = [
    /^\(.*\)\s*=>/,  // Arrow function: (doc, url) => ...
    /^function\s*\(/,  // Function expression: function(...) { ... }
    /^\(\s*function/,  // IIFE-style: (function(...) { ... })
  ];

  const hasValidStart = validPatterns.some((p) => p.test(trimmed));
  if (!hasValidStart) {
    return 'Function must be an arrow function "(doc, url) => ..." or function expression "function(doc, url) { ... }"';
  }

  // Check for obviously unsupported APIs that users might try
  const unsupportedApis = [
    { pattern: /\.querySelector\s*\(/, suggestion: "Use doc.getInnerHTML(selector) or doc.getText(selector) instead" },
    { pattern: /\.querySelectorAll\s*\(/, suggestion: "Use doc.getAllInnerHTML(selector) instead" },
    { pattern: /\.getElementById\s*\(/, suggestion: 'Use doc.getInnerHTML("#id") instead' },
    { pattern: /\.getElementsBy/, suggestion: "Use doc.getAllInnerHTML(selector) instead" },
    { pattern: /document\./, suggestion: "Use the doc object methods: doc.getText(), doc.getInnerHTML(), etc." },
    { pattern: /\.innerHTML(?!\()/, suggestion: "Use doc.getInnerHTML(selector) to get innerHTML" },
    { pattern: /\.textContent/, suggestion: "Use doc.getText(selector) to get text content" },
    { pattern: /\bfetch\s*\(/, suggestion: "Network access is not allowed in sandbox functions" },
    { pattern: /\bawait\s+fetch/, suggestion: "Network access is not allowed in sandbox functions" },
  ];

  for (const { pattern, suggestion } of unsupportedApis) {
    if (pattern.test(trimmed)) {
      return suggestion;
    }
  }

  return null;
}

/**
 * Execute a scope function against HTML content.
 *
 * The function receives a simplified DOM-like structure and the URL.
 * It should return the extracted content as a string or object.
 *
 * @param functionCode - JavaScript function code, e.g., "(doc, url) => doc.getText('h1')"
 * @param html - HTML content to parse
 * @param url - URL of the page (for context)
 * @param options - Execution options
 * @returns Extracted content or error
 */
export async function runScopeFunction(
  functionCode: string,
  html: string,
  url: string,
  options: SandboxExecOptions = {}
): Promise<SandboxResult> {
  // Validate function syntax before execution
  const validationError = validateFunctionSyntax(functionCode);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  // We need to provide a DOM-like API within the sandbox.
  // Since QuickJS doesn't have native DOM, we'll parse the HTML on the host side
  // and pass a serialized representation, or use a simple approach with string manipulation.

  // For now, we'll use a simpler approach: pass the HTML as a string and let the
  // function use regex or string methods. For full DOM support, we'd need linkedom
  // inside the sandbox, which is complex.

  // Wrap the user's function in code that executes it
  const wrappedCode = `
// Simple HTML helper object (not a full DOM, but useful for basic extraction)
const html = ${JSON.stringify(html)};
const url = ${JSON.stringify(url)};

// Simple querySelector-like helper using regex (limited but safe)
const doc = {
  html: html,
  // Get text content between tags
  getText(selector) {
    // Very basic: extract text from matching tags
    const tagMatch = selector.match(/^(\\w+)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const regex = new RegExp('<' + tag + '[^>]*>([\\\\s\\\\S]*?)</' + tag + '>', 'gi');
      const matches = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.push(match[1].replace(/<[^>]+>/g, '').trim());
      }
      return matches.join('\\n');
    }
    return '';
  },
  // Get innerHTML of first matching element
  getInnerHTML(selector) {
    const tagMatch = selector.match(/^(\\w+)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const regex = new RegExp('<' + tag + '[^>]*>([\\\\s\\\\S]*?)</' + tag + '>', 'i');
      const match = regex.exec(html);
      return match ? match[1] : '';
    }
    // Handle class selector
    const classMatch = selector.match(/^\\.(\\w+)$/);
    if (classMatch) {
      const cls = classMatch[1];
      const regex = new RegExp('<[^>]+class="[^"]*\\\\b' + cls + '\\\\b[^"]*"[^>]*>([\\\\s\\\\S]*?)</[^>]+>', 'i');
      const match = regex.exec(html);
      return match ? match[1] : '';
    }
    // Handle ID selector
    const idMatch = selector.match(/^#(\\w+)$/);
    if (idMatch) {
      const id = idMatch[1];
      const regex = new RegExp('<[^>]+id="' + id + '"[^>]*>([\\\\s\\\\S]*?)</[^>]+>', 'i');
      const match = regex.exec(html);
      return match ? match[1] : '';
    }
    return '';
  },
  // Get all matching elements' innerHTML
  getAllInnerHTML(selector) {
    const tagMatch = selector.match(/^(\\w+)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const regex = new RegExp('<' + tag + '[^>]*>([\\\\s\\\\S]*?)</' + tag + '>', 'gi');
      const matches = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.push(match[1]);
      }
      return matches;
    }
    return [];
  },
  // Get attribute value
  getAttribute(selector, attr) {
    const tagMatch = selector.match(/^(\\w+)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const regex = new RegExp('<' + tag + '[^>]*' + attr + '="([^"]*)"[^>]*>', 'i');
      const match = regex.exec(html);
      return match ? match[1] : null;
    }
    return null;
  }
};

// Execute the user's function
let scopeFn;
try {
  scopeFn = ${functionCode};
} catch (parseError) {
  throw new Error('Invalid function syntax: ' + parseError.message);
}

if (typeof scopeFn !== 'function') {
  throw new Error('Code must be a function expression, e.g., "(doc, url) => doc.getText(\\'h1\\')"');
}

let result;
try {
  result = scopeFn(doc, url);
} catch (execError) {
  throw new Error('Function execution error: ' + execError.message);
}
export default result;
`;

  return runInSandbox(wrappedCode, options);
}
