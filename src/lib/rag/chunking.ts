import type { TextChunk } from './types';

const BREAK_POINTS = ['\n\n', '\n', '. '];

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findBreak(text: string, start: number, end: number, maxChars: number): number {
  const window = text.slice(start, end);

  for (const breakPoint of BREAK_POINTS) {
    const offset = window.lastIndexOf(breakPoint);
    if (offset >= maxChars * 0.5) {
      return start + offset + breakPoint.length;
    }
  }

  return end;
}

export function chunkText(text: string, maxChars: number, overlap: number): TextChunk[] {
  if (maxChars <= 0) throw new Error('maxChars must be greater than zero.');
  if (overlap < 0 || overlap >= maxChars) {
    throw new Error('overlap must be greater than or equal to zero and smaller than maxChars.');
  }

  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + maxChars, normalized.length);
    const end = hardEnd < normalized.length ? findBreak(normalized, start, hardEnd, maxChars) : hardEnd;
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({ index: chunks.length, content, start, end });
    }

    if (end >= normalized.length) break;

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
