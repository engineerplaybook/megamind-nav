const DEFAULT_DATABASE_URL = 'postgres://rag:rag@localhost:5432/rag';
const DEFAULT_EMBEDDING_MODEL = 'onnx-community/all-MiniLM-L6-v2-ONNX';

export interface RagConfig {
  databaseUrl: string;
  embeddingModel: string;
  embeddingDimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  pythonBin: string;
  crawlerScript: string;
  crawlTimeoutMs: number;
  modelCacheDir: string;
}

function readString(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

export function getRagConfig(): RagConfig {
  const chunkSize = readInt('RAG_CHUNK_SIZE', 1000);
  const chunkOverlap = readInt('RAG_CHUNK_OVERLAP', 200);

  if (chunkOverlap >= chunkSize) {
    throw new Error('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE.');
  }

  return {
    databaseUrl: readString('DATABASE_URL', DEFAULT_DATABASE_URL),
    embeddingModel: readString('RAG_EMBEDDING_MODEL', DEFAULT_EMBEDDING_MODEL),
    embeddingDimensions: readInt('RAG_EMBEDDING_DIMENSIONS', 384),
    chunkSize,
    chunkOverlap,
    topK: readInt('RAG_TOP_K', 5),
    pythonBin: readString('RAG_PYTHON_BIN', 'python3'),
    crawlerScript: readString('RAG_CRAWLER_SCRIPT', 'worker/crawl4ai_crawl.py'),
    crawlTimeoutMs: readInt('RAG_CRAWL_TIMEOUT_MS', 300_000),
    modelCacheDir: readString('RAG_MODEL_CACHE_DIR', '.cache/transformers'),
  };
}
