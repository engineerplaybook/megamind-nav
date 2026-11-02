import './load-env';
import { readFile } from 'node:fs/promises';
import { chunkText } from './chunking';
import { getRagConfig } from './config';
import { crawlUrls } from './crawler';
import { closePool, getPool, toVectorLiteral } from './db';
import { embedTexts } from './embeddings';
import type { CrawledPage } from './types';

const EMBEDDING_BATCH_SIZE = 32;

interface CliArgs {
  urls: string[];
  urlsFile?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const urls: string[] = [];
  let urlsFile: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--urls-file') {
      urlsFile = argv[index + 1];
      index += 1;
      if (!urlsFile) throw new Error('--urls-file requires a path.');
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    urls.push(arg);
  }

  return { urls, urlsFile };
}

async function readUrlFile(filePath: string): Promise<string[]> {
  const contents = await readFile(filePath, 'utf8');

  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function ingestPage(page: CrawledPage): Promise<number> {
  const config = getRagConfig();
  const chunks = chunkText(page.markdown, config.chunkSize, config.chunkOverlap);
  if (chunks.length === 0) return 0;

  const embeddings: number[][] = [];
  for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
    embeddings.push(...(await embedTexts(batch.map((chunk) => chunk.content))));
  }

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const documentResult = await client.query(
      `INSERT INTO rag_documents (url, title, metadata, crawled_at, updated_at)
       VALUES ($1, $2, $3::jsonb, now(), now())
       ON CONFLICT (url) DO UPDATE
         SET title = EXCLUDED.title,
             metadata = EXCLUDED.metadata,
             crawled_at = now(),
             updated_at = now()
       RETURNING id`,
      [page.url, page.title, JSON.stringify(page.metadata)],
    );

    const documentRow = documentResult.rows[0] as { id: string | number } | undefined;
    if (!documentRow) throw new Error(`Could not upsert document ${page.url}.`);

    await client.query('DELETE FROM rag_chunks WHERE document_id = $1', [documentRow.id]);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const embedding = embeddings[index];

      await client.query(
        `INSERT INTO rag_chunks (document_id, chunk_index, content, metadata, embedding)
         VALUES ($1, $2, $3, $4::jsonb, $5::vector)`,
        [
          documentRow.id,
          chunk.index,
          chunk.content,
          JSON.stringify({
            ...page.metadata,
            start: chunk.start,
            end: chunk.end,
            charCount: chunk.content.length,
          }),
          toVectorLiteral(embedding),
        ],
      );
    }

    await client.query('COMMIT');
    return chunks.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const fileUrls = args.urlsFile ? await readUrlFile(args.urlsFile) : [];
  const urls = [...args.urls, ...fileUrls];

  if (urls.length === 0) {
    throw new Error(
      'Usage: npm run rag:ingest -- <url> [url...] OR npm run rag:ingest -- --urls-file urls.txt',
    );
  }

  const pages = await crawlUrls(urls);
  let ingestedPages = 0;
  let skippedPages = 0;
  let totalChunks = 0;

  for (const page of pages) {
    if (!page.markdown.trim()) {
      skippedPages += 1;
      console.warn(`Skipping ${page.url}: crawler returned no content.`);
      continue;
    }

    const chunkCount = await ingestPage(page);
    if (chunkCount === 0) {
      skippedPages += 1;
      console.warn(`Skipping ${page.url}: no chunks produced.`);
      continue;
    }

    ingestedPages += 1;
    totalChunks += chunkCount;
    console.log(`Ingested ${page.url} (${chunkCount} chunks)`);
  }

  console.log(
    `Done: ${ingestedPages} page(s), ${totalChunks} chunk(s), ${skippedPages} skipped.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
