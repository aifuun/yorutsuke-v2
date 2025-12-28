// Pillar B: Airlock - validate all IPC responses
import { invoke } from '@tauri-apps/api/core';

// Response schemas (validate at boundary)
interface CompressResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  inputPath: string,
  outputPath: string,
): Promise<CompressResult> {
  const result = await invoke<CompressResult>('compress_image', {
    inputPath,
    outputPath,
  });

  // Pillar B: Validate response
  if (typeof result.success !== 'boolean') {
    throw new Error('Invalid compress response: missing success');
  }

  return result;
}

export async function getImageHash(path: string): Promise<string> {
  return invoke<string>('get_image_hash', { path });
}

export async function deleteLocalImage(path: string): Promise<void> {
  await invoke('delete_file', { path });
}
