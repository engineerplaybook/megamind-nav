import { existsSync } from 'node:fs';
import path from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import { getRagConfig } from './config';

interface EmbeddingTensor {
  dims: number[];
  tolist(): number[][];
}

type FeatureExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<EmbeddingTensor>;

let extractorPromise: Promise<FeatureExtractor> | undefined;

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    const config = getRagConfig();
    env.cacheDir = path.resolve(config.modelCacheDir);

    const isLocalModel =
      config.embeddingModel.startsWith('.') || path.isAbsolute(config.embeddingModel);

    if (isLocalModel) {
      const modelPath = path.resolve(config.embeddingModel);
      if (!existsSync(modelPath)) {
        throw new Error(
          `Embedding model directory not found at ${modelPath}. Run: npm run rag:model:download`,
        );
      }
      env.allowRemoteModels = false;
    }

    const promise = pipeline('feature-extraction', config.embeddingModel, {
      dtype: 'fp32',
    }) as unknown as Promise<FeatureExtractor>;

    extractorPromise = promise;
    promise.catch(() => {
      if (extractorPromise === promise) extractorPromise = undefined;
    });
  }

  return extractorPromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const config = getRagConfig();
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  const embeddings = output.tolist();

  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error('Embedding model returned an unexpected number of vectors.');
  }

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== config.embeddingDimensions) {
      throw new Error(
        `Embedding model returned ${embedding.length} dimensions; expected ${config.embeddingDimensions}.`,
      );
    }
  }

  return embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  if (!embedding) throw new Error('Embedding model returned no vector.');
  return embedding;
}
