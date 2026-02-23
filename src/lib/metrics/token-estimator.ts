// Task 2.1: Token Estimator
// Estimates token counts from text content using chars/4 heuristic + overhead

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// Average overhead for system prompts, formatting, etc.
const SYSTEM_OVERHEAD_TOKENS = 50;

/**
 * Estimate token count from text content.
 * Uses chars/4 approximation which is ~80% accurate for English text.
 * For production accuracy, upgrade to tiktoken.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate input + output tokens for a message exchange.
 * Adds system overhead for prompt formatting.
 */
export function estimateMessageTokens(
  inputContent: string,
  outputContent?: string
): TokenEstimate {
  const inputTokens = estimateTokens(inputContent) + SYSTEM_OVERHEAD_TOKENS;
  const outputTokens = outputContent ? estimateTokens(outputContent) : 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * Estimate tokens for a conversation history (array of messages).
 * Each message gets a small per-message overhead (role prefix, formatting).
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>
): number {
  const PER_MESSAGE_OVERHEAD = 4; // role, formatting tokens
  return messages.reduce(
    (total, msg) => total + estimateTokens(msg.content) + PER_MESSAGE_OVERHEAD,
    SYSTEM_OVERHEAD_TOKENS
  );
}
