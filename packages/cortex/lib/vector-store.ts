import { similarity } from "ml-distance";

export class VectorStore {
  embeddings: number[][];

  constructor(embeddings: number[][]) {
    this.embeddings = embeddings;
  }

  search(search: number[], k = 3, excludeIndex?: number) {
    const results = this.embeddings
      .map((vector, index) => ({
        similarity: similarity.cosine(search, vector),
        index,
      }))
      .filter(({ index }) => excludeIndex === undefined || index !== excludeIndex)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(excludeIndex !== undefined ? 0 : 1, (excludeIndex !== undefined ? 0 : 1) + k);

    return results.map((r) => r.index);
  }
}
