/**
 * Server-Sent Events (SSE) broadcaster for real-time updates
 * Manages client connections and broadcasts events to all listeners
 * Supports event batching with configurable window (default 100ms)
 */

import type { SSEEvent } from './types';
import { sseLogger } from '@/lib/logger';

// Store active SSE client connections
const clients = new Set<ReadableStreamDefaultController>();

// Batching state
const BATCH_WINDOW_MS = 100;
let batchBuffer: SSEEvent[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Register a new SSE client connection
 */
export function registerClient(controller: ReadableStreamDefaultController): void {
  clients.add(controller);
}

/**
 * Unregister an SSE client connection
 */
export function unregisterClient(controller: ReadableStreamDefaultController): void {
  clients.delete(controller);
}

/**
 * Flush the current batch buffer to all connected clients
 */
function flushBatch(): void {
  if (batchBuffer.length === 0) return;

  const encoder = new TextEncoder();
  const eventsToSend = batchBuffer;
  batchBuffer = [];
  batchTimer = null;

  // Send batch as array if multiple events, single object if one
  const payload = eventsToSend.length === 1
    ? JSON.stringify(eventsToSend[0])
    : JSON.stringify({ type: 'batch', payload: eventsToSend });

  const data = `data: ${payload}\n\n`;
  const encoded = encoder.encode(data);

  const clientsArray = Array.from(clients);
  for (const client of clientsArray) {
    try {
      client.enqueue(encoded);
    } catch (error) {
      sseLogger.error({ err: error }, 'Failed to send SSE event to client');
      clients.delete(client);
    }
  }

  sseLogger.debug({ events: eventsToSend.length, clients: clients.size }, 'Broadcast events');
}

/**
 * Broadcast an event to all connected SSE clients
 * Events are batched in a 100ms window for efficiency
 */
export function broadcast(event: SSEEvent): void {
  batchBuffer.push(event);

  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
  }
}

/**
 * Broadcast an event immediately without batching (for critical events)
 */
export function broadcastImmediate(event: SSEEvent): void {
  // Flush any pending batch first
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }
  batchBuffer.push(event);
  flushBatch();
}

/**
 * Get the number of active SSE connections
 */
export function getActiveConnectionCount(): number {
  return clients.size;
}
