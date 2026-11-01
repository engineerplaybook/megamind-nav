# RAG User Guide

This project has a small retrieval-augmented generation (RAG) pipeline:

- **Crawl** pages you explicitly list with Crawl4AI.
- **Chunk** the extracted text deterministically.
- **Embed** each chunk locally with `all-MiniLM-L6-v2` (384 dimensions).
- **Store** documents, chunks, metadata, and vectors in PostgreSQL + pgvector.
- **Search** by embedding the question and asking Postgres for the closest chunks.

There is no paid model API in this flow.

## How it works

```text
URLs you provide
      |
      v
worker/crawl4ai_crawl.py     Python + Crawl4AI + robots.txt check
      |
      v
src/lib/rag/ingest.ts        deterministic chunks -> local embeddings
      |
      v
PostgreSQL + pgvector        rag_documents + rag_chunks
      |
      v
POST /nav/api/rag/query/     embed question -> cosine similarity -> top chunks
      |
      v
/nav/rag/                    small search UI
```

Crawling and ingestion run as a script (`npm run rag:ingest`), never inside a user request. The Next.js app only embeds the query and reads from Postgres.

## One-time setup

### 1. Start PostgreSQL

```bash
docker compose up -d db
docker compose ps
```

The database is healthy when `STATUS` shows `Up ... (healthy)`. The first start applies `db/migrations/001_rag.sql`, which enables the `vector` extension, creates the tables, and adds the HNSW index.

### 2. Configure

```bash
cp .env.example .env.local
```

Defaults already match `docker-compose.yml`. Never commit `.env.local`.

### 3. Install the Python crawler

```bash
python3 -m venv worker/.venv
worker/.venv/bin/pip install -r worker/requirements.txt
worker/.venv/bin/python -m playwright install chromium
sudo worker/.venv/bin/python -m playwright install-deps chromium
```

The last command installs Chromium's system libraries. On Ubuntu 26.04 it is equivalent to:

```bash
sudo apt-get install -y libnspr4 libnss3 libasound2t64
```

If you activate the venv, set `RAG_PYTHON_BIN=python3` in `.env.local`. Otherwise keep the default `worker/.venv/bin/python`.

### 4. Download the embedding model

```bash
npm run rag:model:download
```

This fills `.cache/transformers/onnx-community/all-MiniLM-L6-v2-ONNX`. The model is the ONNX port of `sentence-transformers/all-MiniLM-L6-v2`.

### 5. Start the app

```bash
npm run dev
```

Open `http://localhost:3000/nav/rag/`.

## Store documents (ingest)

Pass one or more URLs:

```bash
npm run rag:ingest -- https://react.dev/learn
npm run rag:ingest -- https://react.dev/learn https://react.dev/reference/react
```

Or put one URL per line in a file:

```bash
npm run rag:ingest -- --urls-file urls.txt
```

Rules:

- Only the URLs you pass are crawled. Links are not followed.
- The worker checks each host's `robots.txt` before crawling.
- You are responsible for having permission under the site's terms.
- Each successful page is upserted by URL. Re-running ingestion replaces that page's old chunks.
- Failed or blocked pages are skipped with a warning.

Useful output:

```text
Ingested https://react.dev/learn (27 chunks)
Done: 1 page(s), 27 chunk(s), 0 skipped.
```

For scheduled refreshes, run the same command from cron/CI, for example:

```cron
0 3 * * * cd /path/to/megamind-nav && npm run rag:ingest -- --urls-file urls.txt
```

## Search / retrieve

### UI

Open `http://localhost:3000/nav/rag/`, type a question, and submit. Results show the source URL, title, similarity score, and chunk text.

### API

```bash
curl -X POST http://localhost:3000/nav/api/rag/query/ \
  -H 'content-type: application/json' \
  -d '{"query":"How do I start learning React?","topK":3}'
```

The trailing slash is required because the project uses `trailingSlash: true`.

Response shape:

```json
{
  "query": "How do I start learning React?",
  "results": [
    {
      "url": "https://react.dev/learn",
      "title": "Quick Start - React",
      "content": "Welcome to the React documentation...",
      "score": 0.68,
      "chunkIndex": 0,
      "metadata": {}
    }
  ]
}
```

- `score` is `1 - cosine_distance`; higher is more similar.
- `topK` is optional, defaults to `RAG_TOP_K` (5), and is clamped to 1-50.
- `url` and `title` come from `rag_documents`; `content` comes from `rag_chunks`.

## How retrieval works

1. The question is embedded with the same local MiniLM model used at ingestion time.
2. The vector is sent to Postgres as `$1::vector`.
3. Postgres orders chunks by cosine distance (`<=>`), using the HNSW index.
4. The route returns the top chunks plus their source URLs.

Relevant code:

| File | Responsibility |
|------|----------------|
| `worker/crawl4ai_crawl.py` | Crawl explicit URLs, robots.txt, clean markdown |
| `src/lib/rag/chunking.ts` | Deterministic chunks + overlap |
| `src/lib/rag/embeddings.ts` | Local MiniLM embeddings |
| `src/lib/rag/ingest.ts` | Crawl -> chunk -> embed -> upsert |
| `src/lib/rag/retrieval.ts` | pgvector similarity search |
| `src/lib/rag/db.ts` | PostgreSQL pool |
| `app/api/rag/query/route.ts` | Query endpoint |
| `app/rag/page.tsx` | Search UI |
| `db/migrations/001_rag.sql` | Schema + `vector` extension |

## Inspect the database

```bash
docker exec -it megamind-nav-db-1 psql -U rag -d rag
```

Useful queries:

```sql
-- How many pages and chunks?
SELECT count(*) FROM rag_documents;
SELECT count(*) FROM rag_chunks;

-- What is ingested?
SELECT id, url, title, crawled_at FROM rag_documents ORDER BY crawled_at DESC;

-- Preview chunks for one page
SELECT c.chunk_index, left(c.content, 120)
FROM rag_chunks c
JOIN rag_documents d ON d.id = c.document_id
WHERE d.url = 'https://react.dev/learn'
ORDER BY c.chunk_index;
```

## Tuning

Set these in `.env.local` and restart the dev server / re-run ingestion:

| Variable | Default | Effect |
|----------|---------|--------|
| `RAG_CHUNK_SIZE` | `1000` | Max characters per chunk |
| `RAG_CHUNK_OVERLAP` | `200` | Overlap between chunks; must be smaller than chunk size |
| `RAG_TOP_K` | `5` | Default number of retrieved chunks |
| `RAG_EMBEDDING_MODEL` | local MiniLM path | Model directory or Hugging Face model ID |
| `RAG_EMBEDDING_DIMENSIONS` | `384` | Must match the model and `vector(384)` schema |
| `RAG_PYTHON_BIN` | `worker/.venv/bin/python` | Python used by the Crawl4AI worker |
| `RAG_CRAWL_TIMEOUT_MS` | `300000` | Per-ingest crawl timeout |

After changing chunking, re-run ingestion for the pages so old chunks are replaced.

## Troubleshooting

### `ModuleNotFoundError: No module named 'crawl4ai'`

The worker is using the wrong Python. Either activate the venv:

```bash
source worker/.venv/bin/activate
```

or set this in `.env.local`:

```bash
RAG_PYTHON_BIN=worker/.venv/bin/python
```

### `error while loading shared libraries: libnspr4.so`

Install Chromium's system dependencies:

```bash
sudo worker/.venv/bin/python -m playwright install-deps chromium
```

### `Knowledge search is unavailable` (HTTP 503)

Check:

1. `docker compose ps` shows the database as healthy.
2. `.env.local` has the correct `DATABASE_URL`.
3. The local model exists: `ls .cache/transformers/onnx-community/all-MiniLM-L6-v2-ONNX`.
4. The dev-server log for the underlying error.

### Model download times out

Use the local model path instead of letting Transformers.js fetch at runtime:

```bash
npm run rag:model:download
# .env.local:
RAG_EMBEDDING_MODEL=.cache/transformers/onnx-community/all-MiniLM-L6-v2-ONNX
```

### API returns 308

Use the trailing slash:

```text
/nav/api/rag/query/
```

### `Blocked by robots.txt`

The site disallows crawling for this bot. Choose a URL the site permits, or get explicit permission. Do not disable the robots check.

### No results

- Confirm rows exist: `SELECT count(*) FROM rag_chunks;`
- Ingest at least one URL.
- Try a broader question.
- Re-run ingestion if the page content changed.

## Production notes

- Keep ingestion outside request handlers. Use a scheduled job or CI.
- The current query route loads the embedding model in-process. For serverless production, move query embedding to a dedicated worker/service and keep the Next route retrieval-only.
- `DATABASE_URL` must point at a Postgres instance with the `vector` extension and the migration applied.
- The `.cache/transformers` model directory and `worker/.venv` are local development artifacts and are gitignored.
