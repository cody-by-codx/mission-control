// Task 2.2: Cost Calculator
// Calculates costs using model_pricing from the database

import { queryOne, queryAll, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { ModelPricing, TokenUsage, TokenOperation } from '@/lib/types';

export interface CostResult {
  costUsd: number;
  inputCost: number;
  outputCost: number;
  model: string;
}

// In-memory cache for model pricing (refreshed every 5 min)
let pricingCache: Map<string, ModelPricing> = new Map();
let pricingCacheTime = 0;
const PRICING_CACHE_TTL = 5 * 60 * 1000;

/**
 * Load model pricing from the database, with caching.
 */
export function getModelPricing(modelName: string): ModelPricing | undefined {
  const now = Date.now();
  if (now - pricingCacheTime > PRICING_CACHE_TTL || pricingCache.size === 0) {
    refreshPricingCache();
  }
  return pricingCache.get(modelName);
}

/**
 * Get all model pricing entries.
 */
export function getAllModelPricing(): ModelPricing[] {
  const now = Date.now();
  if (now - pricingCacheTime > PRICING_CACHE_TTL || pricingCache.size === 0) {
    refreshPricingCache();
  }
  return Array.from(pricingCache.values());
}

function refreshPricingCache(): void {
  const rows = queryAll<ModelPricing>('SELECT * FROM model_pricing');
  pricingCache = new Map(rows.map((r) => [r.model_name, r]));
  pricingCacheTime = Date.now();
}

/**
 * Calculate cost for a given number of tokens and model.
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): CostResult {
  const pricing = getModelPricing(modelName);

  if (!pricing) {
    // Fallback: use a default price if model not found
    return {
      costUsd: 0,
      inputCost: 0,
      outputCost: 0,
      model: modelName,
    };
  }

  const inputCost = (inputTokens / 1000) * pricing.input_price_per_1k;
  const outputCost = (outputTokens / 1000) * pricing.output_price_per_1k;

  return {
    costUsd: inputCost + outputCost,
    inputCost,
    outputCost,
    model: modelName,
  };
}

/**
 * Record token usage in the database and return the created record ID.
 */
export function recordTokenUsage(params: {
  agentId: string;
  taskId?: string;
  sessionId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation: TokenOperation;
  metadata?: Record<string, unknown>;
}): string {
  const { costUsd } = calculateCost(params.model, params.inputTokens, params.outputTokens);
  const id = uuidv4();

  run(
    `INSERT INTO token_usage (id, agent_id, task_id, session_id, model, input_tokens, output_tokens, cost_usd, operation, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id,
      params.agentId,
      params.taskId || null,
      params.sessionId || null,
      params.model,
      params.inputTokens,
      params.outputTokens,
      costUsd,
      params.operation,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );

  return id;
}

/**
 * Update model pricing in the database.
 */
export function updateModelPricing(
  modelName: string,
  inputPricePer1k: number,
  outputPricePer1k: number,
  provider: string = 'anthropic'
): void {
  const existing = queryOne<ModelPricing>(
    'SELECT * FROM model_pricing WHERE model_name = ?',
    [modelName]
  );

  if (existing) {
    run(
      `UPDATE model_pricing SET input_price_per_1k = ?, output_price_per_1k = ?, provider = ?, updated_at = datetime('now') WHERE model_name = ?`,
      [inputPricePer1k, outputPricePer1k, provider, modelName]
    );
  } else {
    run(
      `INSERT INTO model_pricing (id, model_name, input_price_per_1k, output_price_per_1k, provider, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [uuidv4(), modelName, inputPricePer1k, outputPricePer1k, provider]
    );
  }

  // Invalidate cache
  pricingCacheTime = 0;
}
