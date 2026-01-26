/**
 * Simple highlight helper - Event-driven approach
 * Issue #157: Highlight transaction when navigating from Capture to Ledger
 *
 * Uses eventBus to avoid relying on component mount/unmount lifecycle
 */

import { emit } from '../eventBus';
import { logger } from '../telemetry';

/**
 * Set transaction ID to highlight and trigger event
 * Emits 'ledger:highlight' event that TransactionView listens to
 */
export function setHighlightTxId(txId: string): void {
  logger.debug('highlight_event_emitted', { txId });

  // Emit event immediately - TransactionView will listen regardless of mount state
  emit('ledger:highlight', { txId });
}

/**
 * Legacy function - kept for compatibility but not used anymore
 * @deprecated Use event listener instead
 */
export function getAndClearHighlightTxId(): string | null {
  logger.debug('deprecated_function_called', { function: 'getAndClearHighlightTxId' });
  return null;
}

/**
 * Check if there's a pending highlight without clearing it
 * @deprecated Not needed with event-driven approach
 */
export function hasPendingHighlight(): boolean {
  return false;
}
