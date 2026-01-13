/**
 * Standard Button Tokens
 * Pre-configured buttons for common actions (Confirm/Cancel/Delete/etc.)
 *
 * Usage:
 *   <ConfirmButton onClick={handleConfirm}>Confirm</ConfirmButton>
 *   <CancelButton onClick={handleCancel} />
 *   <DeleteButton onClick={handleDelete} />
 */

import { ReactNode } from 'react';
import { Check, X, Trash2, RefreshCw, Save, Edit2, Plus, Upload, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import type { ButtonProps } from './Button';

// ============================================================================
// 1. Confirm Button (✓)
// ============================================================================

interface ConfirmButtonProps extends Omit<ButtonProps, 'variant' | 'iconLeft' | 'children'> {
  children?: ReactNode;
}

export function ConfirmButton({ children = 'Confirm', ...props }: ConfirmButtonProps) {
  return (
    <Button variant="primary" iconLeft={<Check size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 2. Cancel Button (no icon)
// ============================================================================

interface CancelButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
  children?: ReactNode;
}

export function CancelButton({ children = 'Cancel', ...props }: CancelButtonProps) {
  return (
    <Button variant="secondary" {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 3. Delete Button (🗑️) - Always requires confirmation
// ============================================================================

interface DeleteButtonProps extends Omit<ButtonProps, 'variant' | 'iconLeft' | 'children'> {
  children?: ReactNode;
}

export function DeleteButton({ children = 'Delete', ...props }: DeleteButtonProps) {
  return (
    <Button variant="danger" iconLeft={<Trash2 size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 4. Close Button (✕) - Icon only
// ============================================================================

interface CloseButtonProps extends Omit<ButtonProps, 'variant' | 'children'> {
  'aria-label'?: string;
}

export function CloseButton({ 'aria-label': ariaLabel = 'Close', ...props }: CloseButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-label={ariaLabel}
      {...props}
    >
      <X size={20} />
    </button>
  );
}

// ============================================================================
// 5. Sync Button (↻)
// ============================================================================

interface SyncButtonProps extends Omit<ButtonProps, 'iconLeft' | 'children'> {
  children?: ReactNode;
  variant?: 'primary' | 'ghost';
}

export function SyncButton({ children = 'Sync', variant = 'primary', ...props }: SyncButtonProps) {
  return (
    <Button variant={variant} iconLeft={<RefreshCw size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 6. Save Button (💾)
// ============================================================================

interface SaveButtonProps extends Omit<ButtonProps, 'variant' | 'iconLeft' | 'children'> {
  children?: ReactNode;
}

export function SaveButton({ children = 'Save', ...props }: SaveButtonProps) {
  return (
    <Button variant="primary" iconLeft={<Save size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 7. Edit Button (✏️)
// ============================================================================

interface EditButtonProps extends Omit<ButtonProps, 'iconLeft' | 'children'> {
  children?: ReactNode;
  variant?: 'ghost' | 'secondary';
}

export function EditButton({ children, variant = 'ghost', ...props }: EditButtonProps) {
  return (
    <Button variant={variant} iconLeft={<Edit2 size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 8. Add Button (➕)
// ============================================================================

interface AddButtonProps extends Omit<ButtonProps, 'variant' | 'iconLeft' | 'children'> {
  children?: ReactNode;
}

export function AddButton({ children = 'Add', ...props }: AddButtonProps) {
  return (
    <Button variant="primary" iconLeft={<Plus size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 9. Upload Button (📤)
// ============================================================================

interface UploadButtonProps extends Omit<ButtonProps, 'variant' | 'iconLeft' | 'children'> {
  children?: ReactNode;
}

export function UploadButton({ children = 'Upload', ...props }: UploadButtonProps) {
  return (
    <Button variant="primary" iconLeft={<Upload size={20} />} {...props}>
      {children}
    </Button>
  );
}

// ============================================================================
// 10. Back Button (🔙)
// ============================================================================

interface BackButtonProps extends Omit<ButtonProps, 'iconLeft' | 'children'> {
  children?: ReactNode;
  variant?: 'ghost' | 'secondary';
}

export function BackButton({ children = 'Back', variant = 'ghost', ...props }: BackButtonProps) {
  return (
    <Button variant={variant} iconLeft={<ArrowLeft size={20} />} {...props}>
      {children}
    </Button>
  );
}
