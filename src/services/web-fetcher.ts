export interface FetchResult {
  url: string;
  statusCode: number;
  redirect: string | null;
  headers: Record<string, string>;
  body: string;
}

export class WebFetcher {
  private userAgent: string;

  constructor(userAgent = "Mozilla/5.0 (compatible; WebContent/1.0)") {
    this.userAgent = userAgent;
  }

  async fetch(url: string): Promise<FetchResult> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
      },
      redirect: "manual",
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await response.text();

    // Check for redirect (3xx status with Location header)
    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");

    return {
      url,
      statusCode: response.status,
      redirect: isRedirect && location ? location : null,
      headers,
      body,
    };
  }
}
