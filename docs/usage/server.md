# Server Usage Guide

The WebContent server provides an HTTP API for fetching and parsing web content.

## Starting the Server

You can run the server using Bun:

```bash
bun run server
```

By default, the server listens on port **233** for local development.

## Configuration

### Custom Port
You can specify a custom port using the `PORT` environment variable:

```bash
PORT=8080 bun run server
```

## Health Check

Verify the server is running by hitting the `/health` endpoint:

```bash
curl http://localhost:233/health
```
**Response**: `{ "status": "ok" }`

## Deployment

The server can be compiled to a standalone binary for easier deployment:

```bash
bun run build:server
```

This creates a self-contained executable that doesn't require Bun to be installed on the host system.

## CORS Support

The server includes full CORS support, allowing it to be called from browser-based applications (like the included `test.html`).
