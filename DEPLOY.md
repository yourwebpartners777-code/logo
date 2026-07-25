# Deploy

## Build

```bash
npm ci
npm run typecheck
npm run build
```

Use Node.js 24 or newer. The backend uses `node:sqlite`.

## Environment

Set these variables on the server:

```env
OPENAI_API_KEY=...
RESEND_API_KEY=...
REPORT_FROM_EMAIL=Dr. Logo <reports@your-domain.com>
APP_ORIGIN=https://your-domain.com
PORT=3001
DB_PATH=./data/dr-logo.sqlite
```

`OPENAI_API_KEY` is required for voice sessions and greeting audio.
`RESEND_API_KEY` is optional for the app flow, but without it email reports are skipped.

## Run

```bash
npm start
```

The Node server serves both API routes and the built frontend from `dist`.
User accounts, password hashes, child profiles, settings, and sessions are stored in SQLite at `DB_PATH`.
Speech session history, course plan, and local UI state are currently stored in the browser `localStorage`.

## Reverse Proxy

Use nginx to expose the app on `80/443` and forward traffic to the Node process on `3001`.
The backend already serves the built frontend from `dist`, so one upstream is enough.

See [`nginx.conf.example`](./nginx.conf.example) for a working template.

Minimal production setup:

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

upstream dr_logo_app {
  server 127.0.0.1:3001;
  keepalive 32;
}

server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://dr_logo_app;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

If you terminate TLS in nginx, keep `APP_ORIGIN` set to your public `https://` URL.
