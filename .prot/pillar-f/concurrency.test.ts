/**
 * Pillar F: Concurrency Testing Template
 *
 * How to test optimistic locking and concurrent updates.
 *
 * ⚠️ AI DEVELOPMENT NOTE:
 * - COPY these patterns when testing concurrent operations
 * - Always test the conflict path, not just happy path
 * - Use delays to simulate real race conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================
// 1. IMPORT FROM YOUR IMPLEMENTATION
// ============================================

// import { StaleDataError, ConcurrencyError } from './optimistic-lock';
// import { updateOrder } from './orderRepository';
// import { orderFactory } from '../testing/factories';

// Inline types for template (replace with actual imports)
class StaleDataError extends Error {
  constructor(
    public readonly entity: string,
    public readonly expectedVersion: number,
    public readonly actualVersion?: number
  ) {
    super(`Stale data: ${entity} version mismatch`);
    this.name = 'StaleDataError';
  }
}

interface Order {
  id: string;
  version: number;
  status: string;
}

// ============================================
// 2. MOCK REPOSITORY
// ============================================

/**
 * Simulates database with version tracking
 */
function createMockOrderRepo() {
  let storedOrder: Order = {
    id: 'order_1',
    version: 1,
    status: 'pending',
  };

  return {
    get: async (id: string): Promise<Order> => {
      return { ...storedOrder };
    },

    update: async (
      id: string,
      expectedVersion: number,
      updates: Partial<Order>
    ): Promise<Order> => {
      // Simulate atomic CAS check
      if (storedOrder.version !== expectedVersion) {
        throw new StaleDataError('Order', expectedVersion, storedOrder.version);
      }

      // Apply update
      storedOrder = {
        ...storedOrder,
        ...updates,
        version: storedOrder.version + 1,
      };

      return { ...storedOrder };
    },

    // Test helper: directly set version
    _setVersion: (v: number) => {
      storedOrder.version = v;
    },
  };
}

// ============================================
// 3. BASIC CAS TESTS
// ============================================

describe('Pillar F: Optimistic Locking', () => {
  let repo: ReturnType<typeof createMockOrderRepo>;

  beforeEach(() => {
    repo = createMockOrderRepo();
  });

  describe('Version Check', () => {
    it('should update successfully with correct version', async () => {
      const order = await repo.get('order_1');

      const updated = await repo.update('order_1', order.version, {
        status: 'confirmed',
      });

      expect(updated.version).toBe(2);
      expect(updated.status).toBe('confirmed');
    });

    it('should throw StaleDataError on version mismatch', async () => {
      const order = await repo.get('order_1');

      // Simulate another process updating first
      repo._setVersion(5);

      await expect(
        repo.update('order_1', order.version, { status: 'confirmed' })
      ).rejects.toThrow(StaleDataError);
    });

    it('should include version info in StaleDataError', async () => {
      const order = await repo.get('order_1');
      repo._setVersion(5);

      try {
        await repo.update('order_1', order.version, { status: 'confirmed' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(StaleDataError);
        expect((error as StaleDataError).expectedVersion).toBe(1);
        expect((error as StaleDataError).actualVersion).toBe(5);
      }
    });
  });
});

// ============================================
// 4. CONCURRENT UPDATE SIMULATION
// ============================================

describe('Concurrent Updates', () => {
  let repo: ReturnType<typeof createMockOrderRepo>;

  beforeEach(() => {
    repo = createMockOrderRepo();
  });

  it('first update wins, second throws StaleDataError', async () => {
    // Both clients read same version
    const clientA = await repo.get('order_1');
    const clientB = await repo.get('order_1');

    expect(clientA.version).toBe(1);
    expect(clientB.version).toBe(1);

    // Client A updates first
    const resultA = await repo.update('order_1', clientA.version, {
      status: 'confirmed',
    });
    expect(resultA.version).toBe(2);

    // Client B tries to update with stale version
    await expect(
      repo.update('order_1', clientB.version, { status: 'cancelled' })
    ).rejects.toThrow(StaleDataError);

    // Verify A's update persisted
    const final = await repo.get('order_1');
    expect(final.status).toBe('confirmed');
  });

  it('sequential updates with refresh succeed', async () => {
    // Client A updates
    const orderA = await repo.get('order_1');
    await repo.update('order_1', orderA.version, { status: 'confirmed' });

    // Client B refreshes before update
    const orderB = await repo.get('order_1'); // Gets version 2
    const resultB = await repo.update('order_1', orderB.version, {
      status: 'shipped',
    });

    expect(resultB.version).toBe(3);
    expect(resultB.status).toBe('shipped');
  });
});

// ============================================
// 5. RACE CONDITION WITH DELAYS
// ============================================

describe('Race Conditions', () => {
  it('simulates real concurrent requests', async () => {
    const repo = createMockOrderRepo();
    const results: Array<{ client: string; success: boolean; error?: Error }> = [];

    // Simulate slow network for client A
    const clientA = async () => {
      const order = await repo.get('order_1');
      await delay(50); // Network delay
      try {
        await repo.update('order_1', order.version, { status: 'A_wins' });
        results.push({ client: 'A', success: true });
      } catch (error) {
        results.push({ client: 'A', success: false, error: error as Error });
      }
    };

    // Client B is faster
    const clientB = async () => {
      const order = await repo.get('order_1');
      await delay(10); // Faster
      try {
        await repo.update('order_1', order.version, { status: 'B_wins' });
        results.push({ client: 'B', success: true });
      } catch (error) {
        results.push({ client: 'B', success: false, error: error as Error });
      }
    };

    // Run concurrently
    await Promise.all([clientA(), clientB()]);

    // Exactly one should succeed
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toBeInstanceOf(StaleDataError);

    // B was faster, so B wins, A fails
    expect(successes[0].client).toBe('B');
    expect(failures[0].client).toBe('A');
  });
});

// ============================================
// 6. RETRY LOGIC TESTS
// ============================================

describe('Retry on Conflict', () => {
  it('should succeed after refresh and retry', async () => {
    const repo = createMockOrderRepo();

    // Simulate update with retry logic
    async function updateWithRetry(
      id: string,
      updates: Partial<Order>,
      maxRetries = 3
    ): Promise<Order> {
      let retries = 0;

      while (retries < maxRetries) {
        const order = await repo.get(id);
        try {
          return await repo.update(id, order.version, updates);
        } catch (error) {
          if (error instanceof StaleDataError && retries < maxRetries - 1) {
            retries++;
            continue; // Refresh and retry
          }
          throw error;
        }
      }

      throw new Error('Max retries exceeded');
    }

    // Simulate conflict on first attempt
    const order = await repo.get('order_1');
    repo._setVersion(2); // Someone else updated

    // Should succeed after retry (gets fresh version)
    const result = await updateWithRetry('order_1', { status: 'confirmed' });
    expect(result.version).toBe(3);
  });
});

// ============================================
// 7. INTEGRATION TEST PATTERN
// ============================================

describe('Integration: Full Saga with CAS', () => {
  it('should handle concurrent saga executions', async () => {
    const repo = createMockOrderRepo();
    const compensations: string[] = [];

    async function processSaga(clientId: string): Promise<void> {
      const order = await repo.get('order_1');

      // Step 1: External call (compensation needed if fails later)
      compensations.push(`${clientId}:step1`);

      // Step 2: CAS update (may fail)
      try {
        await repo.update('order_1', order.version, {
          status: `processed_by_${clientId}`,
        });
      } catch (error) {
        // Rollback step 1
        compensations.pop();
        throw error;
      }
    }

    // Run two sagas concurrently
    const sagaA = processSaga('A');
    const sagaB = processSaga('B');

    const results = await Promise.allSettled([sagaA, sagaB]);

    // One succeeds, one fails
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Only winner's compensation remains
    expect(compensations).toHaveLength(1);
  });
});

// ============================================
// UTILITIES
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// CHECKLIST FOR AI
// ============================================

/**
 * When writing concurrency tests, ensure:
 *
 * - [ ] Test happy path (correct version)
 * - [ ] Test conflict path (StaleDataError)
 * - [ ] Test concurrent execution (Promise.all)
 * - [ ] Test retry logic
 * - [ ] Test compensation rollback on conflict
 * - [ ] Use delays to simulate real race conditions
 * - [ ] Verify only one writer wins
 */
