// Image Lightbox / Confirm Modal Component
// Modal for reviewing receipt images, transaction details, and confirming/deleting

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../../i18n';
import { ConfirmButton, DeleteButton } from '../../../components';
import type { Transaction, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import './ImageLightbox.css';

interface ImageLightboxProps {
  /** Image URL to display */
  imageUrl: string;
  /** Image alt text */
  alt?: string;
  /** Called when lightbox should close */
  onClose: () => void;
  /** Called when user confirms the transaction (with optional edits) */
  onConfirm?: (edits?: {
    amount?: number;
    merchant?: string | null;
    description?: string;
    category?: TransactionCategory;
    date?: string;
  }) => void;
  /** Called when user deletes the transaction */
  onDelete?: () => void;
  /** Whether transaction is already confirmed */
  isConfirmed?: boolean;
  /** Transaction data to display details */
  transaction?: Transaction;
}

export function ImageLightbox({
  imageUrl,
  alt = 'Receipt image',
  onClose,
  onConfirm,
  onDelete,
  isConfirmed = false,
  transaction,
}: ImageLightboxProps) {
  const { t } = useTranslation();

  // Editable state (only used when unconfirmed)
  const [editedType, setEditedType] = useState<TransactionType>(
    transaction?.type || 'expense'
  );
  const [editedAmount, setEditedAmount] = useState<string>(
    transaction?.amount.toString() || ''
  );
  const [editedMerchant, setEditedMerchant] = useState<string>(
    transaction?.merchant || transaction?.description || ''
  );
  const [editedDescription, setEditedDescription] = useState<string>(
    transaction?.description || ''
  );
  const [editedCategory, setEditedCategory] = useState<TransactionCategory>(
    transaction?.category || 'food'
  );
  const [editedDate, setEditedDate] = useState<string>(
    transaction?.date || ''
  );

  // Image zoom state
  const [isZoomed, setIsZoomed] = useState(false);

  // Pan/drag state for zoomed image
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Common merchants for autocomplete (Japanese + English)
  const commonMerchants = [
    // 便利店 (Convenience Stores)
    'セブン-イレブン (7-Eleven)',
    'ローソン (Lawson)',
    'ファミリーマート (FamilyMart)',
    'ミニストップ (MiniStop)',
    'デイリーヤマザキ (Daily Yamazaki)',
    'ニューデイズ (NewDays)',
    // 综合超市 (Supermarkets)
    'イオン (AEON)',
    'イトーヨーカドー (Ito-Yokado)',
    'ライフ (Life)',
    '西友 (Seiyu)',
    'マルエツ (Maruetsu)',
    'サミット (Summit)',
    '業務スーパー (Gyomu Super)',
    'オーケー (OK Store)',
    'マックスバリュ (MaxValu)',
    '東急ストア (Tokyu Store)',
    '成城石井 (Seijo Ishii)',
    'ダイエー (Daiei)',
    // 百货店 (Department Stores)
    '伊勢丹 (Isetan)',
    '三越 (Mitsukoshi)',
    '高島屋 (Takashimaya)',
    '東急ハンズ (Tokyu Hands)',
    'ロフト (Loft)',
    'パルコ (PARCO)',
    'ルミネ (LUMINE)',
    'マルイ (OIOI)',
    // 快餐 (Fast Food)
    'マクドナルド (McDonald\'s)',
    'モスバーガー (Mos Burger)',
    'ケンタッキー (KFC)',
    '吉野家 (Yoshinoya)',
    'すき家 (Sukiya)',
    '松屋 (Matsuya)',
    'なか卯 (Nakau)',
    '餃子の王将 (Gyoza no Ohsho)',
    'サブウェイ (Subway)',
    'バーガーキング (Burger King)',
    // 家庭餐厅 (Family Restaurants)
    'サイゼリヤ (Saizeriya)',
    'ガスト (Gusto)',
    'ジョナサン (Jonathan\'s)',
    'デニーズ (Denny\'s)',
    'ロイヤルホスト (Royal Host)',
    'びっくりドンキー (Bikkuri Donkey)',
    'ココス (Coco\'s)',
    '大戸屋 (Ootoya)',
    'やよい軒 (Yayoi-ken)',
    // 咖啡 (Cafes)
    'スターバックス (Starbucks)',
    'ドトール (Doutor)',
    'タリーズ (Tully\'s)',
    'サンマルクカフェ (St.Marc Cafe)',
    'ミスタードーナツ (Mister Donut)',
    'コメダ珈琲店 (Komeda\'s Coffee)',
    '星乃珈琲店 (Hoshino Coffee)',
    // 药妆店 (Drugstores)
    'マツモトキヨシ (Matsumotokiyoshi)',
    'ウエルシア (Welcia)',
    'ツルハドラッグ (Tsuruha Drug)',
    'スギ薬局 (Sugi Pharmacy)',
    'サンドラッグ (Sun Drug)',
    'ココカラファイン (Cocokara Fine)',
    // 家居折扣店 (Home & Discount)
    'ドン・キホーテ (Don Quijote)',
    'ダイソー (DAISO)',
    'セリア (Seria)',
    'キャンドゥ (Can Do)',
    '無印良品 (MUJI)',
    'ニトリ (Nitori)',
    'カインズ (CAINZ)',
    'コーナン (Kohnan)',
    'コメリ (Komeri)',
  ];

  // Close with zoom and pan reset
  const handleClose = useCallback(() => {
    setIsZoomed(false);
    setPanOffset({ x: 0, y: 0 });
    onClose();
  }, [onClose]);

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Handle pan/drag when zoomed
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isZoomed) {
      // Not zoomed - toggle zoom
      e.stopPropagation();
      setIsZoomed(true);
      return;
    }

    // Zoomed - start panning
    e.preventDefault();
    e.stopPropagation();
    setIsPanning(true);
    setPanStart({
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPanning) return;
    e.preventDefault();
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    if (isZoomed) {
      setIsZoomed(false);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Handle pan/drag on touch devices
  const handleTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!isZoomed) {
      e.stopPropagation();
      setIsZoomed(true);
      return;
    }

    const touch = e.touches[0];
    e.preventDefault();
    setIsPanning(true);
    setPanStart({
      x: touch.clientX - panOffset.x,
      y: touch.clientY - panOffset.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLImageElement>) => {
    if (!isPanning) return;
    const touch = e.touches[0];
    e.preventDefault();
    setPanOffset({
      x: touch.clientX - panStart.x,
      y: touch.clientY - panStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Stop dragging if mouse leaves window
  useEffect(() => {
    if (isPanning) {
      const handleGlobalMouseUp = () => setIsPanning(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isPanning]);

  // Handle confirm with optional edits
  const handleConfirm = () => {
    if (!isConfirmed && transaction) {
      // Check if any fields were edited
      const edits: {
        type?: TransactionType;
        amount?: number;
        merchant?: string | null;
        description?: string;
        category?: TransactionCategory;
        date?: string;
      } = {};

      if (editedType !== transaction.type) {
        edits.type = editedType;
      }
      const parsedAmount = parseFloat(editedAmount);
      if (!isNaN(parsedAmount) && parsedAmount !== transaction.amount) {
        edits.amount = parsedAmount;
      }
      if (editedMerchant !== (transaction.merchant || transaction.description)) {
        edits.merchant = editedMerchant || null;
      }
      if (editedDescription !== transaction.description) {
        edits.description = editedDescription;
      }
      if (editedCategory !== transaction.category) {
        edits.category = editedCategory;
      }
      if (editedDate !== transaction.date) {
        edits.date = editedDate;
      }

      // Pass edits to parent (will update + confirm)
      onConfirm?.(Object.keys(edits).length > 0 ? edits : undefined);
    } else {
      // Already confirmed, just call confirm (no edits)
      onConfirm?.();
    }
    // Note: Parent handler (handleModalConfirm) already closes the modal
  };

  // Format amount for display (no +/- prefix, color indicates type)
  const formatAmount = (amount: number, _type: string) => {
    return `¥${amount.toLocaleString()}`;
  };

  const hasImage = imageUrl && imageUrl.length > 0;

  // Use Portal to render modal at document body level
  // This escapes stacking context from parent's backdrop-filter
  return createPortal(
    <div className="lightbox-overlay" onClick={handleClose}>
      <div className="lightbox-content lightbox-content--with-details" onClick={(e) => e.stopPropagation()}>
        {/* Close button - top right corner */}
        <button
          type="button"
          className="lightbox-close"
          onClick={handleClose}
          aria-label={t('common.close') || 'Close'}
        >
          ✕
        </button>

        <div className="lightbox-body">
          {/* Left: Image */}
          <div className="lightbox-image-section">
            {hasImage ? (
              <div className="lightbox-image-container">
                <img
                  src={imageUrl}
                  alt={alt || 'Receipt image'}
                  className={`lightbox-image ${isZoomed ? 'lightbox-image--zoomed' : ''} ${isPanning ? 'grabbing' : ''}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onDoubleClick={handleDoubleClick}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    '--pan-x': `${panOffset.x}px`,
                    '--pan-y': `${panOffset.y}px`,
                    cursor: isPanning ? 'grabbing' : isZoomed ? 'grab' : 'zoom-in',
                  } as React.CSSProperties}
                />
              </div>
            ) : (
              <div className="lightbox-no-image">
                <span className="no-image-icon">📷</span>
                <span className="no-image-text">{t('transaction.noImage') || 'No image available'}</span>
              </div>
            )}
          </div>

          {/* Right: Transaction Details */}
          {transaction && (
            <div className="lightbox-details-section">
              <h3 className="lightbox-details-title">{t('transaction.details') || 'Transaction Details'}</h3>

              {/* Type - editable toggle if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.type') || 'Type'}:</span>
                {!isConfirmed ? (
                  <div className="type-toggle">
                    <button
                      type="button"
                      className={`type-toggle-btn ${editedType === 'expense' ? 'active' : ''}`}
                      onClick={() => setEditedType('expense')}
                    >
                      {t('transaction.types.expense') || 'Expense'}
                    </button>
                    <button
                      type="button"
                      className={`type-toggle-btn ${editedType === 'income' ? 'active' : ''}`}
                      onClick={() => setEditedType('income')}
                    >
                      {t('transaction.types.income') || 'Income'}
                    </button>
                  </div>
                ) : (
                  <span className="detail-value">{t(`transaction.types.${transaction.type}`)}</span>
                )}
              </div>

              {/* Amount - editable if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.amount') || 'Amount'}:</span>
                {!isConfirmed ? (
                  <input
                    type="number"
                    className="detail-input detail-amount"
                    value={editedAmount}
                    onChange={(e) => setEditedAmount(e.target.value)}
                    placeholder="Amount"
                  />
                ) : (
                  <span className={`detail-value detail-amount ${transaction.type === 'income' ? 'amount--income' : 'amount--expense'}`}>
                    {formatAmount(transaction.amount, transaction.type)}
                  </span>
                )}
              </div>

              {/* Merchant - editable with autocomplete if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.merchant') || 'Merchant'}:</span>
                {!isConfirmed ? (
                  <>
                    <input
                      type="text"
                      className="detail-input"
                      list="merchant-suggestions"
                      value={editedMerchant}
                      onChange={(e) => setEditedMerchant(e.target.value)}
                      placeholder={t('transaction.merchant') || 'Merchant'}
                    />
                    <datalist id="merchant-suggestions">
                      {commonMerchants.map((merchant) => (
                        <option key={merchant} value={merchant} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <span className="detail-value">{transaction.merchant || transaction.description}</span>
                )}
              </div>

              {/* Date - editable if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.date') || 'Date'}:</span>
                {!isConfirmed ? (
                  <input
                    type="date"
                    className="detail-input"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                  />
                ) : (
                  <span className="detail-value">{transaction.date}</span>
                )}
              </div>

              {/* Category - editable if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.category') || 'Category'}:</span>
                {!isConfirmed ? (
                  <select
                    className="detail-input"
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value as TransactionCategory)}
                  >
                    <option value="food">{t('transaction.categories.food')}</option>
                    <option value="transport">{t('transaction.categories.transport')}</option>
                    <option value="shopping">{t('transaction.categories.shopping')}</option>
                    <option value="entertainment">{t('transaction.categories.entertainment')}</option>
                    <option value="utilities">{t('transaction.categories.utilities')}</option>
                    <option value="health">{t('transaction.categories.health')}</option>
                    <option value="other">{t('transaction.categories.other')}</option>
                  </select>
                ) : (
                  <span className="detail-value">{t(`transaction.categories.${transaction.category}`)}</span>
                )}
              </div>

              {/* Description - editable if unconfirmed */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.description') || 'Description'}:</span>
                {!isConfirmed ? (
                  <input
                    type="text"
                    className="detail-input"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder={t('transaction.description') || 'Description'}
                  />
                ) : (
                  <span className="detail-value">{transaction.description}</span>
                )}
              </div>

              {/* Status */}
              <div className="lightbox-detail-row">
                <span className="detail-label">{t('transaction.status') || 'Status'}:</span>
                <span className={`detail-value ${isConfirmed ? 'status--confirmed' : 'status--pending'}`}>
                  {isConfirmed
                    ? (t('transaction.confirmed') || '✓ Confirmed')
                    : (t('transaction.pendingConfirmation') || '⏳ Pending')}
                </span>
              </div>

              {/* Confidence - compact display */}
              {transaction.confidence !== null && transaction.confidence !== undefined && (
                <div className="lightbox-detail-row">
                  <span className="detail-label">{t('transaction.confidence') || 'AI Confidence'}:</span>
                  <span className="detail-value">{Math.round(transaction.confidence * 100)}%</span>
                </div>
              )}

              {/* OCR Raw Text - collapsible at bottom */}
              {transaction.rawText && (
                <details className="lightbox-ocr-details">
                  <summary className="lightbox-ocr-summary">
                    {t('transaction.extractedText') || 'Extracted Text'}
                  </summary>
                  <div className="lightbox-ocr-text">
                    {transaction.rawText}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="lightbox-actions">
          {/* Right: Confirm + Delete buttons */}
          <div className="lightbox-actions-right">
            {onConfirm && !isConfirmed && (
              <ConfirmButton onClick={handleConfirm}>
                {t('common.confirm') || 'Confirm'}
              </ConfirmButton>
            )}
            {onDelete && (
              <DeleteButton onClick={onDelete}>
                {t('common.delete') || 'Delete'}
              </DeleteButton>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
