// Image Adapter
// Pillar B: Airlock - validate at boundary
// Pillar I: Adapter layer isolates Tauri API from business logic

import { exists } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Check if a local file exists
 * Wraps Tauri fs plugin for Service layer
 *
 * @param path - Absolute file path
 * @returns true if file exists, false otherwise
 */
export async function checkFileExists(path: string): Promise<boolean> {
  try {
    return await exists(path);
  } catch (error) {
    // If error, treat as file not exists
    return false;
  }
}

/**
 * Convert local file path to Tauri asset URL
 * Wraps Tauri core API for Service layer
 *
 * @param path - Absolute file path
 * @returns Tauri asset URL (asset://...)
 */
export function getLocalImageUrl(path: string): string {
  return convertFileSrc(path);
}
