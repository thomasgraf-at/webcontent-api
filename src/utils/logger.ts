/**
 * Request Logger
 * - Server: logs to console (with colors)
 * - CLI: logs to file (./logs/requests.log)
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface LogEntry {
  timestamp: number;
  command: string;
  url?: string;
  id?: string;
  ids?: string[];
  status?: number;
  count?: number;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return colors.green;
  if (status >= 300 && status < 400) return colors.yellow;
  return colors.red;
}

function formatCommand(command: string): string {
  // Format: "POST /fetch" -> "POST /fetch", "fetch" -> "fetch"
  const parts = command.split(" ");
  if (parts.length === 2) {
    return `${parts[0].toUpperCase()} ${parts[1].toLowerCase()}`;
  }
  return command.toLowerCase();
}

function formatLogEntry(entry: LogEntry): string {
  const time = formatTime(entry.timestamp);
  const command = formatCommand(entry.command);
  const parts: string[] = [time, command];

  if (entry.url) {
    parts.push(entry.url);
  }

  if (entry.id) {
    parts.push(`id:${entry.id}`);
  }

  if (entry.ids) {
    parts.push(`ids:${entry.ids.length}`);
  }

  if (entry.status !== undefined) {
    parts.push(`${entry.status}`);
  }

  if (entry.count !== undefined) {
    parts.push(`count:${entry.count}`);
  }

  return parts.join(" | ");
}

function formatServerLogEntry(entry: LogEntry): string {
  const time = `${colors.dim}${formatTime(entry.timestamp)}${colors.reset}`;
  const command = formatCommand(entry.command);
  const parts: string[] = [time, command];

  if (entry.url) {
    parts.push(entry.url);
  }

  if (entry.id) {
    parts.push(`id:${entry.id}`);
  }

  if (entry.ids) {
    parts.push(`ids:${entry.ids.length}`);
  }

  if (entry.status !== undefined) {
    const statusColor = getStatusColor(entry.status);
    parts.push(`${statusColor}${entry.status}${colors.reset}`);
  }

  if (entry.count !== undefined) {
    parts.push(`count:${entry.count}`);
  }

  return parts.join(" | ");
}

// CLI logging - writes to file (no colors)
// Project root: src/utils/logger.ts -> ../../logs/
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const LOG_DIR = join(PROJECT_ROOT, "logs");
const LOG_FILE = join(LOG_DIR, "requests.log");

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function logRequest(entry: LogEntry): void {
  const line = formatLogEntry(entry);
  try {
    ensureLogDir();
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // Silently fail if can't write to log file
  }
}

// Server logging - writes to console (with colors)
export function logServerRequest(entry: LogEntry): void {
  const line = formatServerLogEntry(entry);
  console.log(`\u27A4 ${line}`);
}
