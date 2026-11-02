export interface CrawledPage {
  url: string;
  finalUrl?: string;
  title: string;
  markdown: string;
  metadata: Record<string, unknown>;
}

export interface TextChunk {
  index: number;
  content: string;
  start: number;
  end: number;
}

export interface RetrievedChunk {
  url: string;
  title: string;
  content: string;
  score: number;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}
