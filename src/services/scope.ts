/**
 * Scope types for content extraction.
 * See docs/implementation/scope.md for detailed specification.
 */

/**
 * Selector-based scope configuration.
 * Extracts content matching CSS selectors.
 */
export interface SelectorScope {
  type: "selector";
  include: string[];
  exclude?: string[];
}

/**
 * Function-based scope configuration.
 * Provides custom extraction logic as JavaScript code.
 * Code is executed in a sandboxed environment.
 */
export interface FunctionScope {
  type: "function";
  code: string;
  /** Execution timeout in milliseconds (default: 5000, max: 60000) */
  timeout?: number;
}

/**
 * Handler reference scope.
 * References a site handler from the database.
 */
export interface HandlerScope {
  type: "handler";
  id: string;
}

/**
 * All possible scope configurations.
 */
export type Scope =
  | "main"
  | "full"
  | "auto"
  | SelectorScope
  | FunctionScope
  | HandlerScope;

/**
 * Result of scope resolution for "auto" scope.
 */
export interface ScopeResolution {
  /** The scope that was actually used */
  scopeUsed: Scope;
  /** Whether the scope was resolved from "auto" */
  scopeResolved: boolean;
  /** Handler ID if a handler was matched */
  handlerId?: string;
}

/**
 * Check if scope is a simple string scope
 */
export function isSimpleScope(scope: Scope): scope is "main" | "full" | "auto" {
  return typeof scope === "string";
}

/**
 * Check if scope is a selector scope
 */
export function isSelectorScope(scope: Scope): scope is SelectorScope {
  return typeof scope === "object" && scope.type === "selector";
}

/**
 * Check if scope is a function scope
 */
export function isFunctionScope(scope: Scope): scope is FunctionScope {
  return typeof scope === "object" && scope.type === "function";
}

/**
 * Check if scope is a handler reference
 */
export function isHandlerScope(scope: Scope): scope is HandlerScope {
  return typeof scope === "object" && scope.type === "handler";
}

/**
 * Parse scope from CLI string argument.
 * Handles:
 * - Simple scopes: "main", "full", "auto"
 * - Selector shorthand: "selector:article,.content" or "selector:article,.content:--.ads,nav"
 * - JSON object scopes
 */
export function parseScopeArg(arg: string, excludeArg?: string): Scope {
  // Simple scopes
  if (arg === "main" || arg === "full" || arg === "auto") {
    return arg;
  }

  // JSON object
  if (arg.startsWith("{")) {
    const parsed = JSON.parse(arg);
    return validateScope(parsed);
  }

  // Selector shorthand: "selector:article,.content"
  if (arg.startsWith("selector:")) {
    const selectorPart = arg.slice("selector:".length);
    const include = selectorPart.split(",").map((s) => s.trim()).filter(Boolean);

    if (include.length === 0) {
      throw new Error("Selector scope requires at least one include selector");
    }

    const scope: SelectorScope = { type: "selector", include };

    // Add exclude if provided
    if (excludeArg) {
      scope.exclude = excludeArg.split(",").map((s) => s.trim()).filter(Boolean);
    }

    return scope;
  }

  throw new Error(
    `Invalid scope: "${arg}". Must be "main", "full", "auto", "selector:...", or a JSON object.`
  );
}

/**
 * Validate a scope object structure
 */
export function validateScope(obj: unknown): Scope {
  if (typeof obj === "string") {
    if (obj === "main" || obj === "full" || obj === "auto") {
      return obj;
    }
    throw new Error(`Invalid scope string: "${obj}"`);
  }

  if (typeof obj !== "object" || obj === null) {
    throw new Error("Scope must be a string or object");
  }

  const scope = obj as Record<string, unknown>;

  if (!("type" in scope)) {
    throw new Error("Scope object must have a 'type' field");
  }

  switch (scope.type) {
    case "selector": {
      if (!Array.isArray(scope.include) || scope.include.length === 0) {
        throw new Error("Selector scope requires non-empty 'include' array");
      }
      const result: SelectorScope = {
        type: "selector",
        include: scope.include as string[],
      };
      if (scope.exclude) {
        if (!Array.isArray(scope.exclude)) {
          throw new Error("Selector scope 'exclude' must be an array");
        }
        result.exclude = scope.exclude as string[];
      }
      return result;
    }

    case "function": {
      if (typeof scope.code !== "string" || !scope.code.trim()) {
        throw new Error("Function scope requires non-empty 'code' string");
      }
      const result: FunctionScope = { type: "function", code: scope.code };
      if (scope.timeout !== undefined) {
        const timeout = Number(scope.timeout);
        if (isNaN(timeout) || timeout < 1 || timeout > 60000) {
          throw new Error("Function scope timeout must be between 1 and 60000 ms");
        }
        result.timeout = timeout;
      }
      return result;
    }

    case "handler": {
      if (typeof scope.id !== "string" || !scope.id.trim()) {
        throw new Error("Handler scope requires non-empty 'id' string");
      }
      return { type: "handler", id: scope.id };
    }

    default:
      throw new Error(`Unknown scope type: "${scope.type}"`);
  }
}

/**
 * Normalize scope for caching/hashing purposes.
 * For "auto" scope, returns the resolved scope.
 */
export function normalizeScope(scope: Scope, resolved?: Scope): Scope {
  if (scope === "auto" && resolved) {
    return resolved;
  }
  return scope;
}

/**
 * Convert scope to a display string for logging
 */
export function scopeToString(scope: Scope): string {
  if (typeof scope === "string") {
    return scope;
  }

  switch (scope.type) {
    case "selector":
      return `selector:[${scope.include.join(",")}]`;
    case "function":
      return "function";
    case "handler":
      return `handler:${scope.id}`;
    default:
      return "unknown";
  }
}
