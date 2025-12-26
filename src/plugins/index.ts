import type { DataPlugin, DataRequest, DataResponse, PluginOptions } from "./types";
import { headingsPlugin } from "./headings";

export type { DataPlugin, DataRequest, DataResponse, PluginOptions };
export { headingsPlugin };

const plugins: Record<string, DataPlugin> = {
  headings: headingsPlugin,
};

export function getAvailablePlugins(): string[] {
  return Object.keys(plugins);
}

export function isValidPlugin(name: string): boolean {
  return name in plugins;
}

export function parseDataParam(
  data?: string | DataRequest
): DataRequest | null {
  if (!data) return null;

  if (typeof data === "object") {
    return data;
  }

  // Check if it's JSON
  if (data.startsWith("{")) {
    try {
      return JSON.parse(data);
    } catch {
      throw new Error("Invalid JSON in data parameter");
    }
  }

  // Comma-separated list
  const result: DataRequest = {};
  const names = data.split(",").map((s) => s.trim()).filter(Boolean);
  for (const name of names) {
    result[name] = true;
  }
  return result;
}

export async function runPlugins(
  html: string,
  requested: DataRequest
): Promise<DataResponse> {
  const results: DataResponse = {};

  for (const [name, options] of Object.entries(requested)) {
    const plugin = plugins[name];
    if (!plugin) {
      throw new Error(`Unknown data plugin: ${name}`);
    }

    const opts = options === true ? {} : options;
    const result = await plugin.execute(html, opts);
    results[name] = result;
  }

  return results;
}
