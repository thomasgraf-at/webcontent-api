/**
 * QuickJS Sandbox Service
 * Provides isolated JavaScript execution for function scope extraction.
 * Uses WebAssembly-based QuickJS for secure sandboxing.
 */

import { loadQuickJs, type SandboxOptions } from "@sebastianwessel/quickjs";
// @ts-ignore - wasm variant import
import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { DOMBridge, type SerializedNodeData } from "./dom-bridge";

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
    /^\(.*\)\s*=>/, // Arrow function: (api, url) => ...
    /^function\s*\(/, // Function expression: function(...) { ... }
    /^\(\s*function/, // IIFE-style: (function(...) { ... })
  ];

  const hasValidStart = validPatterns.some((p) => p.test(trimmed));
  if (!hasValidStart) {
    return 'Function must be an arrow function "(api, url) => ..." or function expression "function(api, url) { ... }"';
  }

  // Check for obviously unsupported APIs that users might try
  const unsupportedApis = [
    {
      pattern: /document\./,
      suggestion:
        "Use the api object methods: api.$(), api.$$(), etc.",
    },
    {
      pattern: /\bfetch\s*\(/,
      suggestion: "Network access is not allowed in sandbox functions",
    },
    {
      pattern: /\bawait\s+fetch/,
      suggestion: "Network access is not allowed in sandbox functions",
    },
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
 * The function receives a DOM-like API object and the URL.
 * It should return the extracted content as a string or object.
 *
 * @param functionCode - JavaScript function code, e.g., "(api, url) => api.$('h1')?.text"
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

  // Parse HTML on host side using linkedom
  const bridge = new DOMBridge(html);

  // Pre-execute all queries by analyzing the function code
  // and collecting results that will be needed
  const queryResults = new Map<string, SerializedNodeData | null>();
  const queryAllResults = new Map<string, SerializedNodeData[]>();

  // Extract selectors from function code and pre-cache results
  const selectors = extractSelectorsFromCode(functionCode);
  for (const selector of selectors) {
    queryResults.set(selector, bridge.querySelector(selector));
    queryAllResults.set(selector, bridge.querySelectorAll(selector));
  }

  // Build the sandbox code with pre-cached query results and bridge functions
  const wrappedCode = generateSandboxCode(
    functionCode,
    html,
    url,
    queryResults,
    queryAllResults,
    bridge
  );

  return runInSandbox(wrappedCode, options);
}

/**
 * Extract CSS selectors from function code for pre-caching.
 */
function extractSelectorsFromCode(code: string): string[] {
  const patterns = [
    /\$\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /\$\$\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /querySelector\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /querySelectorAll\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /closest\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ];

  const selectors = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      selectors.add(match[1]);
    }
  }
  return Array.from(selectors);
}

/**
 * Generate the sandbox code with the API and pre-cached results.
 */
function generateSandboxCode(
  functionCode: string,
  html: string,
  url: string,
  queryResults: Map<string, SerializedNodeData | null>,
  queryAllResults: Map<string, SerializedNodeData[]>,
  bridge: DOMBridge
): string {
  // Serialize the pre-cached results
  const cachedQueries: Record<string, SerializedNodeData | null> = {};
  const cachedQueryAlls: Record<string, SerializedNodeData[]> = {};

  for (const [selector, result] of queryResults) {
    cachedQueries[selector] = result;
  }
  for (const [selector, results] of queryAllResults) {
    cachedQueryAlls[selector] = results;
  }

  // We need to handle dynamic queries (child queries, traversal)
  // by serializing the bridge's node map and methods
  // For simplicity, we'll inline all the bridge method results

  // Collect all node IDs and their data for child queries
  const allNodes: Record<number, SerializedNodeData> = {};
  const collectNode = (node: SerializedNodeData | null) => {
    if (node) allNodes[node._id] = node;
  };
  const collectNodes = (nodes: SerializedNodeData[]) => {
    nodes.forEach(collectNode);
  };

  for (const result of queryResults.values()) {
    collectNode(result);
  }
  for (const results of queryAllResults.values()) {
    collectNodes(results);
  }

  // For child queries and traversal, we need to call back to the bridge
  // Since QuickJS is synchronous, we pre-compute all possible child queries
  // This is a simplified approach - we'll evaluate dynamically in the sandbox
  // using a serialized representation

  return `
const __html = ${JSON.stringify(html)};
const __url = ${JSON.stringify(url)};
const __cachedQueries = ${JSON.stringify(cachedQueries)};
const __cachedQueryAlls = ${JSON.stringify(cachedQueryAlls)};
const __allNodes = ${JSON.stringify(allNodes)};

// Bridge call results - populated dynamically
const __childQueryCache = {};
const __childQueryAllCache = {};
const __closestCache = {};
const __parentCache = {};
const __childrenCache = {};
const __firstChildCache = {};
const __lastChildCache = {};
const __nextSiblingCache = {};
const __prevSiblingCache = {};

// Inject bridge results for dynamic queries
${generateBridgeResults(bridge, allNodes)}

function createNode(data) {
  if (!data) return null;

  const node = {
    _id: data._id,
    tag: data.tag,
    text: data.text,
    html: data.html,
    outerHtml: data.outerHtml,
    attrs: data.attrs,
    dataAttrs: data.dataAttrs,
    classes: data.classes,

    attr(name) {
      return this.attrs[name] !== undefined ? this.attrs[name] : null;
    },

    dataAttr(name) {
      return this.dataAttrs[name] !== undefined ? this.dataAttrs[name] : null;
    },

    hasClass(name) {
      return this.classes.includes(name);
    },

    // Child queries
    $(selector) {
      const cacheKey = this._id + ':' + selector;
      if (__childQueryCache[cacheKey] !== undefined) {
        return createNode(__childQueryCache[cacheKey]);
      }
      return null;
    },

    $$(selector) {
      const cacheKey = this._id + ':' + selector;
      if (__childQueryAllCache[cacheKey] !== undefined) {
        return __childQueryAllCache[cacheKey].map(createNode);
      }
      return [];
    },

    querySelector(s) { return this.$(s); },
    querySelectorAll(s) { return this.$$(s); },

    // Traversal
    closest(selector) {
      const cacheKey = this._id + ':' + selector;
      if (__closestCache[cacheKey] !== undefined) {
        return createNode(__closestCache[cacheKey]);
      }
      return null;
    },

    parent(selector) {
      const cacheKey = this._id + ':' + (selector || '');
      if (__parentCache[cacheKey] !== undefined) {
        return createNode(__parentCache[cacheKey]);
      }
      return null;
    },

    get children() {
      if (__childrenCache[this._id] !== undefined) {
        return __childrenCache[this._id].map(createNode);
      }
      return [];
    },

    get firstChild() {
      if (__firstChildCache[this._id] !== undefined) {
        return createNode(__firstChildCache[this._id]);
      }
      return null;
    },

    get lastChild() {
      if (__lastChildCache[this._id] !== undefined) {
        return createNode(__lastChildCache[this._id]);
      }
      return null;
    },

    get nextSibling() {
      if (__nextSiblingCache[this._id] !== undefined) {
        return createNode(__nextSiblingCache[this._id]);
      }
      return null;
    },

    get prevSibling() {
      if (__prevSiblingCache[this._id] !== undefined) {
        return createNode(__prevSiblingCache[this._id]);
      }
      return null;
    },
  };

  return node;
}

const api = {
  html: __html,
  url: __url,

  $(selector) {
    if (__cachedQueries[selector] !== undefined) {
      return createNode(__cachedQueries[selector]);
    }
    return null;
  },

  $$(selector) {
    if (__cachedQueryAlls[selector] !== undefined) {
      return __cachedQueryAlls[selector].map(createNode);
    }
    return [];
  },

  querySelector(s) { return this.$(s); },
  querySelectorAll(s) { return this.$$(s); },
};

// Execute the user's function
let scopeFn;
try {
  scopeFn = ${functionCode};
} catch (parseError) {
  throw new Error('Invalid function syntax: ' + parseError.message);
}

if (typeof scopeFn !== 'function') {
  throw new Error('Code must be a function expression, e.g., "(api, url) => api.$(\\'h1\\')?.text"');
}

let result;
try {
  result = scopeFn(api, __url);
} catch (execError) {
  throw new Error('Function execution error: ' + execError.message);
}
export default result;
`;
}

/**
 * Generate bridge results for dynamic queries (child queries, traversal).
 * This pre-computes all possible queries for nodes that exist.
 */
function generateBridgeResults(
  bridge: DOMBridge,
  allNodes: Record<number, SerializedNodeData>
): string {
  const lines: string[] = [];

  // For each node, pre-compute traversal results
  for (const nodeId of Object.keys(allNodes).map(Number)) {
    // Children
    const children = bridge.children(nodeId);
    if (children.length > 0) {
      lines.push(`__childrenCache[${nodeId}] = ${JSON.stringify(children)};`);
      // Also add children to allNodes for nested queries
      children.forEach((child) => {
        allNodes[child._id] = child;
      });
    }

    // First/last child
    const firstChild = bridge.firstChild(nodeId);
    if (firstChild) {
      lines.push(
        `__firstChildCache[${nodeId}] = ${JSON.stringify(firstChild)};`
      );
      allNodes[firstChild._id] = firstChild;
    }

    const lastChild = bridge.lastChild(nodeId);
    if (lastChild) {
      lines.push(`__lastChildCache[${nodeId}] = ${JSON.stringify(lastChild)};`);
      allNodes[lastChild._id] = lastChild;
    }

    // Siblings
    const nextSibling = bridge.nextSibling(nodeId);
    if (nextSibling) {
      lines.push(
        `__nextSiblingCache[${nodeId}] = ${JSON.stringify(nextSibling)};`
      );
      allNodes[nextSibling._id] = nextSibling;
    }

    const prevSibling = bridge.prevSibling(nodeId);
    if (prevSibling) {
      lines.push(
        `__prevSiblingCache[${nodeId}] = ${JSON.stringify(prevSibling)};`
      );
      allNodes[prevSibling._id] = prevSibling;
    }

    // Parent (without selector)
    const parent = bridge.parent(nodeId);
    if (parent) {
      lines.push(`__parentCache['${nodeId}:'] = ${JSON.stringify(parent)};`);
      allNodes[parent._id] = parent;
    }
  }

  return lines.join("\n");
}
