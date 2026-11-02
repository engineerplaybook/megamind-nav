import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { getRagConfig } from './config';
import type { CrawledPage } from './types';

const execFileAsync = promisify(execFile);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http(s) URLs are supported: ${value}`);
  }

  return parsed.toString();
}

function parseCrawledPages(output: string): CrawledPage[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error(`Crawler returned invalid JSON: ${output.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Crawler returned an unexpected response shape.');
  }

  return parsed.map((item, index) => {
    if (!isRecord(item) || typeof item.url !== 'string' || typeof item.markdown !== 'string') {
      throw new Error(`Crawler returned an invalid page at index ${index}.`);
    }

    return {
      url: item.url,
      finalUrl: typeof item.final_url === 'string' ? item.final_url : undefined,
      title:
        typeof item.title === 'string' && item.title.trim().length > 0
          ? item.title.trim()
          : item.url,
      markdown: item.markdown,
      metadata: isRecord(item.metadata) ? item.metadata : {},
    };
  });
}

export async function crawlUrls(urls: string[]): Promise<CrawledPage[]> {
  const uniqueUrls = Array.from(new Set(urls.map(normalizeUrl)));
  if (uniqueUrls.length === 0) {
    throw new Error('Provide at least one URL to crawl.');
  }

  const config = getRagConfig();
  const scriptPath = path.resolve(config.crawlerScript);

  let stdout: string;
  try {
    const result = await execFileAsync(config.pythonBin, [scriptPath, '--urls', ...uniqueUrls], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: config.crawlTimeoutMs,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    stdout = result.stdout;
  } catch (error) {
    if (error instanceof Error && 'stderr' in error && typeof error.stderr === 'string') {
      throw new Error(`Crawl4AI worker failed: ${error.stderr.trim() || error.message}`);
    }
    throw error;
  }

  return parseCrawledPages(stdout);
}
