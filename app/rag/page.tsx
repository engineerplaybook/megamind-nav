'use client';

import { useState, type FormEvent } from 'react';

interface RagResult {
  url: string;
  title: string;
  content: string;
  score: number;
  chunkIndex: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(payload: unknown): string | null {
  if (isRecord(payload) && typeof payload.error === 'string') return payload.error;
  return null;
}

function parseResults(payload: unknown): RagResult[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return [];

  return payload.results.flatMap((item) => {
    if (!isRecord(item) || typeof item.url !== 'string' || typeof item.content !== 'string') {
      return [];
    }

    return [
      {
        url: item.url,
        title: typeof item.title === 'string' ? item.title : item.url,
        content: item.content,
        score: typeof item.score === 'number' ? item.score : 0,
        chunkIndex: typeof item.chunkIndex === 'number' ? item.chunkIndex : 0,
      },
    ];
  });
}

export default function RagPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RagResult[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('../api/rag/query/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmedQuery, topK: 5 }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(payload) ?? `Request failed (${response.status}).`);
      }

      setResults(parseResults(payload));
    } catch (requestError) {
      setResults([]);
      setError(requestError instanceof Error ? requestError.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
        Knowledge search
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Search the pages that were crawled with <code>npm run rag:ingest</code>.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0' }}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask a question about the ingested pages"
          aria-label="Search query"
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            font: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || query.trim().length === 0}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            borderRadius: 8,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            cursor: isLoading ? 'wait' : 'pointer',
            font: 'inherit',
          }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error ? (
        <p role="alert" style={{ color: 'var(--destructive)' }}>
          {error}
        </p>
      ) : null}

      {results.length === 0 && !isLoading && !error ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          No results yet. Ingest at least one URL first.
        </p>
      ) : null}

      <section style={{ display: 'grid', gap: '1rem' }}>
        {results.map((result) => (
          <article
            key={`${result.url}-${result.chunkIndex}`}
            style={{
              padding: '1rem',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              background: 'var(--surface-color)',
            }}
          >
            <header style={{ marginBottom: '0.5rem' }}>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-color)', fontWeight: 600 }}
              >
                {result.title}
              </a>
              <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                score {result.score.toFixed(3)}
              </span>
            </header>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
              {result.content}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
