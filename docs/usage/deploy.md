# Deployment Guide

This guide covers running and deploying the WebContent server.

## Development

### Running the Server

```bash
bun run server
```

The server listens on port **233** by default.

### Development Mode (with watch)

```bash
bun run dev:server
```

Automatically restarts on file changes.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 233 |

```bash
PORT=8080 bun run server
```

## Health Check

Verify the server is running:

```bash
curl http://localhost:233/health
```

**Response**: `{ "status": "ok" }`

## Production Deployment

### Compile to Binary

Build a standalone executable that doesn't require Bun:

```bash
bun run build:server
```

Output: `dist/webcontent-server`

### Run the Binary

```bash
./dist/webcontent-server
# or with custom port
PORT=8080 ./dist/webcontent-server
```

### Docker (Example)

```dockerfile
FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build:server

FROM debian:bookworm-slim
COPY --from=builder /app/dist/webcontent-server /usr/local/bin/
EXPOSE 8080
ENV PORT=8080
CMD ["webcontent-server"]
```

### Systemd Service (Example)

```ini
[Unit]
Description=WebContent Server
After=network.target

[Service]
Type=simple
Environment=PORT=8080
ExecStart=/usr/local/bin/webcontent-server
Restart=always

[Install]
WantedBy=multi-user.target
```

## Features

### CORS Support

Full CORS support enabled for browser-based clients:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

### Test Page

Open `test.html` in a browser for interactive API testing (requires server running).
