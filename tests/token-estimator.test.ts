// Task 2.23: Tests for token-estimator
import assert from 'node:assert/strict';
import {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
} from '../src/lib/metrics/token-estimator';

console.log('Running token-estimator tests...\n');

// --- estimateTokens ---
{
  // Empty string returns 0
  assert.equal(estimateTokens(''), 0);
  console.log('  PASS: estimateTokens("") === 0');

  // chars/4 approximation
  assert.equal(estimateTokens('abcd'), 1);
  console.log('  PASS: estimateTokens("abcd") === 1');

  // Rounds up
  assert.equal(estimateTokens('abcde'), 2);
  console.log('  PASS: estimateTokens("abcde") === 2 (rounds up)');

  // Longer text
  const text400 = 'a'.repeat(400);
  assert.equal(estimateTokens(text400), 100);
  console.log('  PASS: estimateTokens(400 chars) === 100');

  // Handles unicode (counts characters)
  const emoji = '😀😀😀😀'; // 4 emoji, each 2 chars in JS
  assert.equal(estimateTokens(emoji), 2);
  console.log('  PASS: estimateTokens(4 emoji) === 2');
}

// --- estimateMessageTokens ---
{
  // Input only
  const result = estimateMessageTokens('Hello, world!');
  assert.ok(result.inputTokens > 0, 'inputTokens should be > 0');
  assert.equal(result.outputTokens, 0, 'outputTokens should be 0 when no output');
  assert.equal(result.totalTokens, result.inputTokens, 'totalTokens = inputTokens when no output');
  console.log('  PASS: estimateMessageTokens input only');

  // Input + output
  const result2 = estimateMessageTokens('Hello', 'World');
  assert.ok(result2.inputTokens > 0);
  assert.ok(result2.outputTokens > 0);
  assert.equal(result2.totalTokens, result2.inputTokens + result2.outputTokens);
  console.log('  PASS: estimateMessageTokens input + output');

  // Includes overhead
  const resultSmall = estimateMessageTokens('a');
  assert.ok(resultSmall.inputTokens > 1, 'Should include overhead tokens');
  console.log('  PASS: estimateMessageTokens includes system overhead');
}

// --- estimateConversationTokens ---
{
  // Empty conversation
  const result = estimateConversationTokens([]);
  assert.ok(result > 0, 'Should have system overhead even for empty conversation');
  console.log('  PASS: estimateConversationTokens empty has overhead');

  // Multi-message conversation
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
  ];
  const result2 = estimateConversationTokens(messages);
  assert.ok(result2 > result, 'More messages = more tokens');
  console.log('  PASS: estimateConversationTokens multi-message');

  // Proportional to content length
  const shortMessages = [{ role: 'user', content: 'Hi' }];
  const longMessages = [{ role: 'user', content: 'a'.repeat(4000) }];
  assert.ok(
    estimateConversationTokens(longMessages) > estimateConversationTokens(shortMessages),
    'Longer content = more tokens'
  );
  console.log('  PASS: estimateConversationTokens proportional to length');
}

console.log('\n All token-estimator tests passed!');
