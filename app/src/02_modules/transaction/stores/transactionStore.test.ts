import { describe, it, expect, beforeEach } from 'vitest';
import { transactionStore } from './transactionStore';
import type { Transaction } from '../../../01_domains/transaction';
import { TransactionId, UserId, ImageId } from '../../../00_kernel/types';

// Test fixture factory
const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: TransactionId('tx-1'),
  userId: UserId('user-1'),
  imageId: ImageId('img-1'),
  s3Key: null,
  type: 'expense',
  category: 'shopping',
  amount: 1000,
  currency: 'JPY',
  description: 'Test transaction',
  merchant: 'Test Merchant',
  date: '2026-01-15',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
  status: 'unconfirmed',
  confidence: null,
  rawText: null,
  primaryModelId: null,
  primaryConfidence: null,
  ...overrides,
});

describe('transactionStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    transactionStore.setState({
      status: 'idle',
      transactions: [],
      error: null,
      totalCount: 0,
      filters: {},
    });
  });

  describe('Initial State (Pillar D: FSM)', () => {
    it('TC-ST-1.1: Should initialize with idle status', () => {
      const state = transactionStore.getState();
      expect(state.status).toBe('idle');
      expect(state.transactions).toEqual([]);
      expect(state.error).toBeNull();
    });

    it('TC-ST-1.2: Should have proper FSM state type', () => {
      const state = transactionStore.getState();
      const validStates = ['idle', 'loading', 'saving', 'error'];
      expect(validStates).toContain(state.status);
    });
  });

  describe('State Setters', () => {
    it('TC-ST-2.1: Should update status', () => {
      transactionStore.getState().setStatus('loading');
      expect(transactionStore.getState().status).toBe('loading');

      transactionStore.getState().setStatus('error');
      expect(transactionStore.getState().status).toBe('error');

      transactionStore.getState().setStatus('idle');
      expect(transactionStore.getState().status).toBe('idle');
    });

    it('TC-ST-2.2: Should set transactions immutably', () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1'), amount: 100 });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), amount: 200 });

      transactionStore.getState().setTransactions([tx1, tx2]);
      expect(transactionStore.getState().transactions).toHaveLength(2);
      expect(transactionStore.getState().transactions[0].amount).toBe(100);
    });

    it('TC-ST-2.3: Should set error message', () => {
      transactionStore.getState().setError('Network error');
      expect(transactionStore.getState().error).toBe('Network error');

      transactionStore.getState().setError(null);
      expect(transactionStore.getState().error).toBeNull();
    });

    it('TC-ST-2.4: Should set total count for pagination', () => {
      transactionStore.getState().setTotalCount(150);
      expect(transactionStore.getState().totalCount).toBe(150);
    });

    it('TC-ST-2.5: Should set filters', () => {
      const filters = { statusFilter: 'confirmed' as const, typeFilter: 'income' as const };
      transactionStore.getState().setFilters(filters);
      expect(transactionStore.getState().filters).toEqual(filters);
    });
  });

  describe('Mutations: addTransaction', () => {
    it('TC-ST-3.1: Should add transaction to empty list', () => {
      const tx = createTransaction({ id: TransactionId('new-tx') });
      transactionStore.getState().addTransaction(tx);

      const state = transactionStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].id).toBe('new-tx');
      expect(state.error).toBeNull();
    });

    it('TC-ST-3.2: Should append transaction immutably', () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });

      transactionStore.getState().addTransaction(tx1);
      const firstLength = transactionStore.getState().transactions.length;
      transactionStore.getState().addTransaction(tx2);

      expect(transactionStore.getState().transactions).toHaveLength(firstLength + 1);
      expect(transactionStore.getState().transactions[0].id).toBe('tx-1');
      expect(transactionStore.getState().transactions[1].id).toBe('tx-2');
    });

    it('TC-ST-3.3: Should clear error when adding transaction', () => {
      transactionStore.getState().setError('Previous error');
      const tx = createTransaction();
      transactionStore.getState().addTransaction(tx);

      expect(transactionStore.getState().error).toBeNull();
    });
  });

  describe('Mutations: updateTransaction', () => {
    beforeEach(() => {
      const tx1 = createTransaction({ id: TransactionId('tx-1'), amount: 100 });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), amount: 200 });
      transactionStore.setState({ transactions: [tx1, tx2] });
    });

    it('TC-ST-4.1: Should update transaction fields', () => {
      transactionStore.getState().updateTransaction(TransactionId('tx-1'), { amount: 500 });

      const tx = transactionStore.getState().transactions[0];
      expect(tx.amount).toBe(500);
    });

    it('TC-ST-4.2: Should update multiple fields', () => {
      transactionStore.getState().updateTransaction(TransactionId('tx-1'), {
        amount: 750,
        status: 'confirmed',
        merchant: 'Updated Merchant',
      });

      const tx = transactionStore.getState().transactions[0];
      expect(tx.amount).toBe(750);
      expect(tx.status).toBe('confirmed');
      expect(tx.merchant).toBe('Updated Merchant');
    });

    it('TC-ST-4.3: Should update updatedAt timestamp', () => {
      const beforeUpdate = transactionStore.getState().transactions[0].updatedAt;
      transactionStore.getState().updateTransaction(TransactionId('tx-1'), { amount: 900 });
      const afterUpdate = transactionStore.getState().transactions[0].updatedAt;

      expect(afterUpdate).not.toBe(beforeUpdate);
      expect(new Date(afterUpdate).getTime()).toBeGreaterThan(new Date(beforeUpdate).getTime());
    });

    it('TC-ST-4.4: Should not affect other transactions', () => {
      const tx2Before = transactionStore.getState().transactions[1];
      transactionStore.getState().updateTransaction(TransactionId('tx-1'), { amount: 999 });
      const tx2After = transactionStore.getState().transactions[1];

      expect(tx2After.amount).toBe(tx2Before.amount);
      expect(tx2After.id).toBe(tx2Before.id);
    });

    it('TC-ST-4.5: Should handle update of non-existent transaction gracefully', () => {
      const countBefore = transactionStore.getState().transactions.length;
      transactionStore.getState().updateTransaction(TransactionId('nonexistent'), { amount: 500 });
      const countAfter = transactionStore.getState().transactions.length;

      expect(countAfter).toBe(countBefore);
    });

    it('TC-ST-4.6: Should clear error when updating', () => {
      transactionStore.getState().setError('Previous error');
      transactionStore.getState().updateTransaction(TransactionId('tx-1'), { amount: 500 });

      expect(transactionStore.getState().error).toBeNull();
    });
  });

  describe('Mutations: removeTransaction', () => {
    beforeEach(() => {
      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });
      const tx3 = createTransaction({ id: TransactionId('tx-3') });
      transactionStore.setState({ transactions: [tx1, tx2, tx3] });
    });

    it('TC-ST-5.1: Should remove transaction from list', () => {
      transactionStore.getState().removeTransaction(TransactionId('tx-2'));

      const transactions = transactionStore.getState().transactions;
      expect(transactions).toHaveLength(2);
      expect(transactions.map(t => t.id)).toEqual(['tx-1', 'tx-3']);
    });

    it('TC-ST-5.2: Should handle remove of non-existent transaction', () => {
      const countBefore = transactionStore.getState().transactions.length;
      transactionStore.getState().removeTransaction(TransactionId('nonexistent'));
      const countAfter = transactionStore.getState().transactions.length;

      expect(countAfter).toBe(countBefore);
    });

    it('TC-ST-5.3: Should clear error when removing', () => {
      transactionStore.getState().setError('Previous error');
      transactionStore.getState().removeTransaction(TransactionId('tx-1'));

      expect(transactionStore.getState().error).toBeNull();
    });

    it('TC-ST-5.4: Should remove all items correctly', () => {
      transactionStore.getState().removeTransaction(TransactionId('tx-1'));
      transactionStore.getState().removeTransaction(TransactionId('tx-2'));
      transactionStore.getState().removeTransaction(TransactionId('tx-3'));

      expect(transactionStore.getState().transactions).toHaveLength(0);
    });
  });

  describe('Mutations: confirmTransaction', () => {
    beforeEach(() => {
      const tx1 = createTransaction({ id: TransactionId('tx-1'), status: 'unconfirmed' });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), status: 'unconfirmed' });
      transactionStore.setState({ transactions: [tx1, tx2] });
    });

    it('TC-ST-6.1: Should confirm transaction', () => {
      transactionStore.getState().confirmTransaction(TransactionId('tx-1'));

      const tx = transactionStore.getState().transactions[0];
      expect(tx.status).toBe('confirmed');
    });

    it('TC-ST-6.2: Should update timestamp on confirmation', () => {
      const beforeConfirm = transactionStore.getState().transactions[0].updatedAt;
      transactionStore.getState().confirmTransaction(TransactionId('tx-1'));
      const afterConfirm = transactionStore.getState().transactions[0].updatedAt;

      expect(afterConfirm).not.toBe(beforeConfirm);
    });

    it('TC-ST-6.3: Should not affect other transactions', () => {
      const tx2Before = transactionStore.getState().transactions[1];
      transactionStore.getState().confirmTransaction(TransactionId('tx-1'));
      const tx2After = transactionStore.getState().transactions[1];

      expect(tx2After.status).toBe('unconfirmed');
    });

    it('TC-ST-6.4: Should clear error on confirmation', () => {
      transactionStore.getState().setError('Previous error');
      transactionStore.getState().confirmTransaction(TransactionId('tx-1'));

      expect(transactionStore.getState().error).toBeNull();
    });
  });

  describe('Getters (Service Access)', () => {
    beforeEach(() => {
      const tx1 = createTransaction({ id: TransactionId('tx-1'), amount: 100 });
      const tx2 = createTransaction({ id: TransactionId('tx-2'), amount: 200 });
      transactionStore.setState({
        transactions: [tx1, tx2],
        status: 'loading',
        error: 'Test error',
        totalCount: 50,
        filters: { statusFilter: 'confirmed' as const },
      });
    });

    it('TC-ST-7.1: Should provide getter for transactions', () => {
      const txs = transactionStore.getState().getTransactions();
      expect(txs).toHaveLength(2);
      expect(txs[0].amount).toBe(100);
    });

    it('TC-ST-7.2: Should provide getter for status', () => {
      const status = transactionStore.getState().getStatus();
      expect(status).toBe('loading');
    });

    it('TC-ST-7.3: Should provide getter for total count', () => {
      const count = transactionStore.getState().getTotalCount();
      expect(count).toBe(50);
    });

    it('TC-ST-7.4: Should provide getter for filters', () => {
      const filters = transactionStore.getState().getFilters();
      expect(filters.statusFilter).toBe('confirmed');
    });

    it('TC-ST-7.5: Should provide getter for error', () => {
      const error = transactionStore.getState().getError();
      expect(error).toBe('Test error');
    });
  });

  describe('Immutability & Side Effects', () => {
    it('TC-ST-8.1: Should not mutate state directly', () => {
      const tx = createTransaction();
      transactionStore.getState().addTransaction(tx);

      const txs = transactionStore.getState().transactions;
      const originalLength = txs.length;

      transactionStore.getState().addTransaction(createTransaction({ id: TransactionId('tx-new') }));

      expect(transactionStore.getState().transactions.length).toBe(originalLength + 1);
    });

    it('TC-ST-8.2: Should trigger subscriptions on state change', () => {
      let callCount = 0;
      const unsubscribe = transactionStore.subscribe(() => {
        callCount++;
      });

      transactionStore.getState().setStatus('loading');
      expect(callCount).toBe(1);

      transactionStore.getState().addTransaction(createTransaction());
      expect(callCount).toBe(2);

      unsubscribe();
      transactionStore.getState().setStatus('idle');
      expect(callCount).toBe(2); // Should not increase after unsubscribe
    });

    it('TC-ST-8.3: Multiple operations should trigger multiple subscriptions', () => {
      const callCounts: any[] = [];
      const unsubscribe = transactionStore.subscribe((state) => {
        callCounts.push(state.status);
      });

      transactionStore.getState().setStatus('loading');
      transactionStore.getState().setStatus('saving');
      transactionStore.getState().setStatus('idle');

      expect(callCounts).toEqual(['loading', 'saving', 'idle']);
      unsubscribe();
    });
  });

  describe('Concurrent Operations', () => {
    it('TC-ST-9.1: Should handle concurrent adds correctly', () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });
      const tx3 = createTransaction({ id: TransactionId('tx-3') });

      transactionStore.getState().addTransaction(tx1);
      transactionStore.getState().addTransaction(tx2);
      transactionStore.getState().addTransaction(tx3);

      expect(transactionStore.getState().transactions).toHaveLength(3);
      expect(transactionStore.getState().transactions.map(t => t.id)).toEqual(['tx-1', 'tx-2', 'tx-3']);
    });

    it('TC-ST-9.2: Should handle concurrent add and remove', () => {
      const tx1 = createTransaction({ id: TransactionId('tx-1') });
      const tx2 = createTransaction({ id: TransactionId('tx-2') });

      transactionStore.getState().addTransaction(tx1);
      transactionStore.getState().addTransaction(tx2);
      transactionStore.getState().removeTransaction(TransactionId('tx-1'));

      expect(transactionStore.getState().transactions).toHaveLength(1);
      expect(transactionStore.getState().transactions[0].id).toBe('tx-2');
    });

    it('TC-ST-9.3: Should handle rapid state changes', () => {
      for (let i = 0; i < 100; i++) {
        transactionStore.getState().setStatus(i % 2 === 0 ? 'loading' : 'idle');
      }

      const status = transactionStore.getState().status;
      expect(['loading', 'idle']).toContain(status);
    });
  });
});
