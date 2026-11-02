# Engineer Playbook — Common Nav

Shared navigation component for engineerplaybook.io. Served as both a Next.js app and a universal web component.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Design System:** `@engineerplaybook/design-system` (shared tokens + components)
- **Web Component Build:** Vite + `vite-plugin-webcomponent`
- **Navigation:** Shadow DOM encapsulated `<engineering-playbook-nav>` custom element
- **RAG:** Crawl4AI worker + local MiniLM embeddings + PostgreSQL/pgvector

## How It Works

The nav is built **twice**:
1. **Vite** bundles `src/main.tsx` into a vanilla web component (`public/common-nav.js`)
2. **Next.js** builds the app shell (`app/`) for SSR and fallback pages

The web component is loaded via `<script>` in every other app's layout and renders inside a shadow DOM `<engineering-playbook-nav>` element.

## Development

```bash
npm install
npm run dev     # http://localhost:3000/nav/
```

The Vite web component is auto-built before the Next.js dev server starts.

## Build

```bash
npm run build    # vite build && next build
npm run lint
```

## Routes

| Path | Description |
|------|-------------|
| `/nav/` | Nav standalone (debugging) |
| `/nav/rag/` | Knowledge search UI |
| `POST /nav/api/rag/query/` | Vector similarity query endpoint |

## RAG (PostgreSQL + pgvector)

See [`RAG_USER_GUIDE.md`](./RAG_USER_GUIDE.md) for the user-focused guide (ingesting, searching, tuning, and troubleshooting).

Retrieval code lives in `src/lib/rag/`; the Python Crawl4AI worker lives in `worker/`. The worker only crawls. Chunking, local embeddings, and database writes run in the Node ingestion script so query and ingestion share the same embedding code. Ingestion is a script and is never triggered by an API request.

### 1. Start PostgreSQL

```bash
docker compose up -d db
```

The compose file uses `pgvector/pgvector:pg16`, persists data in the `rag_pgdata` volume, and applies `db/migrations/001_rag.sql` on first start. That migration enables the `vector` extension, creates the tables, and adds the HNSW index.

If the volume already exists, or you use an external database, apply the migration manually:

```bash
psql "$DATABASE_URL" -f db/migrations/001_rag.sql
```

### 2. Configure

```bash
cp .env.example .env.local
```

The defaults match `docker-compose.yml`. Never commit `.env.local`.

### 3. Install the crawler worker

Crawl4AI requires Python 3.10+ (3.11/3.12 recommended):

```bash
python3 -m venv worker/.venv
worker/.venv/bin/pip install -r worker/requirements.txt
worker/.venv/bin/python -m playwright install chromium
sudo worker/.venv/bin/python -m playwright install-deps chromium
```

The last command installs the system libraries Chromium needs. On Ubuntu 26.04 it is equivalent to:

```bash
sudo apt-get install -y libnspr4 libnss3 libasound2t64
```

If you activate the virtualenv, set `RAG_PYTHON_BIN=python3` in `.env.local`. Otherwise the default `worker/.venv/bin/python` is used.

### 4. Download the local embedding model

```bash
npm run rag:model:download
```

This populates `.cache/transformers/` once. It uses the ONNX port of `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) and does not call a paid API.

### 5. Crawl and ingest

Only the URLs you pass are crawled; links are not followed. The worker checks each host's `robots.txt` first. Make sure you have permission to crawl the target site under its terms.

```bash
npm run rag:ingest -- https://example.com/page https://example.com/other

# Or one URL per line:
npm run rag:ingest -- --urls-file urls.txt
```

The script chunks text deterministically (default 1000 characters, 200 overlap), embeds it locally with the ONNX port of `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions), and upserts documents/chunks into PostgreSQL. The model is loaded from `.cache/transformers`; no paid model API is used.

### 6. Query

```bash
npm run dev
```

Open `http://localhost:3000/nav/rag/`, or call the endpoint directly:

```bash
curl -X POST http://localhost:3000/nav/api/rag/query/ \
  -H 'content-type: application/json' \
  -d '{"query":"how do I deploy the nav?","topK":5}'
```

Results include the source URL, title, chunk text, chunk index, metadata, and cosine similarity score.

Notes:

- Run ingestion as a separate script, cron job, or CI step. Do not crawl inside a Next.js request.
- The query route loads the embedding model in-process for local development. For production/serverless, move query embedding into the worker or a dedicated service so the Next route only performs retrieval.

## Deployment

Deploys independently to Vercel. Gateway routes `engineerplaybook.io/nav/*` here.

Other apps reference it via `NEXT_PUBLIC_COMMON_NAV_URL` env var:

```bash
vercel deploy
```
