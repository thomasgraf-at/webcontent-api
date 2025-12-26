export interface DataPlugin<TOptions = unknown, TOutput = unknown> {
  name: string;
  description: string;
  execute(html: string, options: TOptions): TOutput | Promise<TOutput>;
}

export type PluginOptions = boolean | Record<string, unknown>;

export type DataRequest = Record<string, PluginOptions>;

export type DataResponse = Record<string, unknown>;
