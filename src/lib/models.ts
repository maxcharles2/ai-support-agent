import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface ModelDefinition {
  id: string;
  displayName: string;
}

export const MODELS: ModelDefinition[] = [
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    displayName: "Llama 3.2 3B Instruct",
  },
  {
    id: "google/gemma-4-31b-it:free",
    displayName: "Gemma 4 31B",
  },
];

const DEFAULT_MODEL_ID = MODELS[0].id;

export function resolveModel(modelId?: string) {
  const id = modelId && MODELS.some((m) => m.id === modelId) ? modelId : DEFAULT_MODEL_ID;
  return openrouter(id);
}
