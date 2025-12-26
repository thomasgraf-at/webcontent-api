/**
 * Parse a TTL string into seconds.
 * Supports formats:
 * - Plain number: "3600" -> 3600
 * - Minutes: "60min", "60m" -> 3600
 * - Hours: "6hours", "6h" -> 21600
 * - Days: "10days", "10d" -> 864000
 * - Months: "3months", "3mo" -> 7776000 (30 days per month)
 * - Years: "1year", "1y" -> 31536000
 */
export function parseTtl(ttl: string | number | undefined): number | undefined {
  if (ttl === undefined || ttl === null || ttl === "") {
    return undefined;
  }

  // If already a number, return it
  if (typeof ttl === "number") {
    return ttl;
  }

  const str = ttl.trim().toLowerCase();

  // Plain number
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Parse duration with unit
  const match = str.match(/^(\d+)\s*(min|m|hours?|h|days?|d|months?|mo|years?|y)$/);
  if (!match) {
    return undefined;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "min":
    case "m":
      return value * 60;
    case "hour":
    case "hours":
    case "h":
      return value * 60 * 60;
    case "day":
    case "days":
    case "d":
      return value * 24 * 60 * 60;
    case "month":
    case "months":
    case "mo":
      return value * 30 * 24 * 60 * 60;
    case "year":
    case "years":
    case "y":
      return value * 365 * 24 * 60 * 60;
    default:
      return undefined;
  }
}

/**
 * Default TTL: 30 days in seconds
 */
export const DEFAULT_TTL = 30 * 24 * 60 * 60;
