import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embed(text: string): Promise<number[]> {
  const clean = text.replace(/\n/g, " ").trim();
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: clean,
    encoding_format: "float",
  });
  return res.data[0].embedding;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const clean = texts.map((t) => t.replace(/\n/g, " ").trim());
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: clean,
    encoding_format: "float",
  });
  return res.data.map((d) => d.embedding);
}

/** Format a pgvector literal from a float array */
export function toVector(arr: number[]): string {
  return `[${arr.join(",")}]`;
}
