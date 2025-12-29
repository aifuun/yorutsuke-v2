// Pillar B: Airlock - validate all IPC responses
// Pillar I: Adapter layer isolates Tauri API from business logic
import { invoke } from '@tauri-apps/api/core';
import type { ImageId } from '../../../00_kernel/types';

// Compression timeout (15 seconds)
const COMPRESS_TIMEOUT_MS = 15_000;

// Response schema matching Rust CompressResult
interface CompressResult {
  success: boolean;
  id: string;
  original_path: string;
  output_path: string;
  original_size: number;
  compressed_size: number;
  width: number;
  height: number;
  md5: string;
}

// Validated result type for domain use
export interface ImageCompressResult {
  id: ImageId;
  originalPath: string;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  md5: string;
}

/**
 * Wrap a promise with timeout protection
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Validate CompressResult from Rust IPC
 * Pillar B: Validate at boundary
 */
function validateCompressResult(raw: unknown): CompressResult {
  const result = raw as CompressResult;

  if (typeof result.success !== 'boolean') {
    throw new Error('Invalid compress response: missing success');
  }
  if (typeof result.id !== 'string') {
    throw new Error('Invalid compress response: missing id');
  }
  if (typeof result.output_path !== 'string') {
    throw new Error('Invalid compress response: missing output_path');
  }
  if (typeof result.md5 !== 'string') {
    throw new Error('Invalid compress response: missing md5');
  }

  return result;
}

/**
 * Compress image via Rust IPC
 *
 * @param inputPath - Source image path
 * @param imageId - Unique image ID (passed to Rust, used for output filename)
 * @returns Compression result with paths and metadata
 * @throws Error on compression failure or timeout
 */
export async function compressImage(
  inputPath: string,
  imageId: ImageId,
): Promise<ImageCompressResult> {
  const rawResult = await withTimeout(
    invoke<CompressResult>('compress_image', {
      inputPath,
      imageId: String(imageId),
    }),
    COMPRESS_TIMEOUT_MS,
    'Compression timeout (15s)'
  );

  // Pillar B: Validate response at boundary
  const result = validateCompressResult(rawResult);

  // Convert to domain types (Pillar A: Branded types)
  return {
    id: imageId,
    originalPath: result.original_path,
    outputPath: result.output_path,
    originalSize: result.original_size,
    compressedSize: result.compressed_size,
    width: result.width,
    height: result.height,
    md5: result.md5,
  };
}

/**
 * Get MD5 hash of an image file
 * Used for duplicate detection before compression
 */
export async function getImageHash(path: string): Promise<string> {
  const hash = await invoke<string>('get_image_hash', { path });

  if (typeof hash !== 'string' || hash.length !== 32) {
    throw new Error('Invalid hash response');
  }

  return hash;
}

/**
 * Delete a local image file
 */
export async function deleteLocalImage(path: string): Promise<void> {
  await invoke('delete_file', { path });
}
