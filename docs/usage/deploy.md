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
| `TURSO_URL` | Database connection URL | - |
| `TURSO_AUTH_TOKEN` | Database auth token | - |

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

### Docker

The Dockerfile uses Node.js with Bun for proper native dependency support:

```dockerfile
FROM node:20-slim
WORKDIR /app
RUN npm install -g bun
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["bun", "run", "src/server/index.ts"]
```

Build and run locally:

```bash
docker build -t webcontent-server .
docker run -p 8080:8080 \
  -e TURSO_URL=libsql://... \
  -e TURSO_AUTH_TOKEN=... \
  webcontent-server
```

> **Note**: Uses `npm install` instead of `bun install` to properly install native dependencies like `@libsql/client`.

---

## Google Cloud Run

Deploy to Cloud Run using Cloud Build (no local Docker required).

**Live deployment**: https://webcontent-683135941939.europe-west1.run.app

### Prerequisites

```bash
# Install gcloud CLI: https://cloud.google.com/sdk/docs/install

# Authenticate and set project
gcloud auth login
gcloud config set project thomasgraf-utils
```

### One-Time Setup

```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create webcontent \
  --repository-format=docker \
  --location=europe-west1 \
  --description="WebContent API"
```

### Build and Deploy

```bash
# Build image in the cloud (no local Docker needed)
gcloud builds submit --tag europe-west1-docker.pkg.dev/thomasgraf-utils/webcontent/server:latest

# Deploy to Cloud Run
gcloud run deploy webcontent \
  --image europe-west1-docker.pkg.dev/thomasgraf-utils/webcontent/server:latest \
  --region europe-west1 \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars "TURSO_URL=libsql://webcontent-thgr.aws-eu-west-1.turso.io" \
  --set-env-vars "TURSO_AUTH_TOKEN=your-token"
```

### Update Deployment

```bash
# Rebuild and redeploy
gcloud builds submit \
  --tag europe-west1-docker.pkg.dev/thomasgraf-utils/webcontent/server:latest

gcloud run deploy webcontent \
  --image europe-west1-docker.pkg.dev/thomasgraf-utils/webcontent/server:latest \
  --region europe-west1
```

### Useful Commands

```bash
# View service details
gcloud run services describe webcontent --region europe-west1

# View logs
gcloud run services logs read webcontent --region europe-west1

# Get service URL
gcloud run services describe webcontent --region europe-west1 \
  --format="value(status.url)"

# List revisions
gcloud run revisions list --service webcontent --region europe-west1

# Delete service
gcloud run services delete webcontent --region europe-west1
```

---

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
