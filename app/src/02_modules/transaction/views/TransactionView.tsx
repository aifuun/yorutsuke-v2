// Pillar L: Views are pure JSX, logic in headless hooks
import { useTransactionLogic } from '../headless/useTransactionLogic';
import type { UserId } from '../../../00_kernel/types';
import type { Transaction } from '../../../01_domains/transaction';

interface TransactionViewProps {
  userId: UserId | null;
}

export function TransactionView({ userId }: TransactionViewProps) {
  const { state, transactions, unconfirmedCount, confirm, remove } = useTransactionLogic(userId);

  // Handle all states
  if (state.status === 'idle') return <div>Please log in</div>;
  if (state.status === 'loading') return <div>Loading transactions...</div>;
  if (state.status === 'error') {
    return (
      <div className="error">
        <p>Error: {state.error}</p>
      </div>
    );
  }

  return (
    <div className="transaction-container">
      <div className="transaction-header">
        <h2>Transactions</h2>
        {unconfirmedCount > 0 && (
          <span className="badge">{unconfirmedCount} unconfirmed</span>
        )}
      </div>

      {state.status === 'saving' && <div className="saving-indicator">Saving...</div>}

      <div className="transaction-list">
        {transactions.length === 0 ? (
          <p>No transactions yet</p>
        ) : (
          transactions.map((t) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              onConfirm={() => confirm(t.id)}
              onDelete={() => remove(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TransactionItemProps {
  transaction: Transaction;
  onConfirm: () => void;
  onDelete: () => void;
}

function TransactionItem({ transaction, onConfirm, onDelete }: TransactionItemProps) {
  const isConfirmed = !!transaction.confirmedAt;

  return (
    <div className={`transaction-item ${transaction.type} ${isConfirmed ? 'confirmed' : ''}`}>
      <div className="transaction-info">
        <span className="category">{transaction.category}</span>
        <span className="description">{transaction.description}</span>
        <span className="date">{transaction.date}</span>
      </div>
      <div className="transaction-amount">
        <span className={transaction.type === 'income' ? 'positive' : 'negative'}>
          {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
        </span>
      </div>
      <div className="transaction-actions">
        {!isConfirmed && (
          <button onClick={onConfirm} className="confirm-btn">
            Confirm
          </button>
        )}
        <button onClick={onDelete} className="delete-btn">
          Delete
        </button>
      </div>
    </div>
  );
}
