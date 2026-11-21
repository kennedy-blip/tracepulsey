# TracePulse

A distributed trace waterfall explorer, span latency profiler and bottleneck analyzer.

## Included

- Vite + React + TypeScript SPA with Tailwind CSS v4 and a responsive dark observability UI.
- Vercel Serverless Functions: `GET/POST /api/traces` and `POST /api/analyze`.
- Seeded checkout/STK, RAG/vector search, and webhook fan-out traces.
- Span hierarchy, proportional waterfall timeline, status filters, search, span attributes, self-time, trace share, critical-path and latency hints.
- Synthetic trace generation and graceful seeded-data fallback when running Vite without the Vercel API runtime.
- GitHub Actions build workflow runs `npm install` and `npm run build` on pushes and pull requests.

## Development

```bash
npm install
npm run dev
```

For the complete local serverless API, run `npx vercel dev`. Verify the production bundle with `npm run build`.

## API

- `GET /api/traces` — list traces.
- `POST /api/traces` — ingest a trace or append spans to an existing trace ID.
- `POST /api/analyze` — analyze span self-time, critical path, trace share, and bottlenecks.

Trace storage is intentionally in-memory for this starter/demo. Use a durable store such as Postgres, Redis, or an observability backend before relying on it across serverless instances in production.

## Deploy

Import `kennedy-blip/tracepulsey` into Vercel with the repository root as the project root. The Vite build output is `dist`; Vercel serves the `/api` serverless functions from the same project.
