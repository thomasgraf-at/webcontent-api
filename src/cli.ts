#!/usr/bin/env bun

import { fetchCommand, storeCommand, getCommand, getsCommand } from "./commands";

const VERSION = "1.0.0";

function showHelp(): void {
  console.log(`
webcontent - Web content fetching API

Usage:
  webcontent <command> [options]

Commands:
  fetch <url>    Fetch a web page (always fresh, bypasses cache)
  store <url>    Store page data directly in database
  get            Get a stored page by ID
  gets           Get multiple stored pages by IDs

Global Options:
  -h, --help     Show this help message
  -v, --version  Show version number

Examples:
  webcontent fetch https://example.com
  webcontent fetch https://example.com --store --ttl 7d
  webcontent get --id abc123def456
  webcontent gets --ids abc123,def456,ghi789

Run 'webcontent <command> --help' for more information on a command.
`);
}

function showVersion(): void {
  console.log(`webcontent v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    showHelp();
    process.exit(0);
  }

  if (args[0] === "-v" || args[0] === "--version") {
    showVersion();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "fetch":
      await fetchCommand(commandArgs);
      break;
    case "store":
      await storeCommand(commandArgs);
      break;
    case "get":
      await getCommand(commandArgs);
      break;
    case "gets":
      await getsCommand(commandArgs);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main();
