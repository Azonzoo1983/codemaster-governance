/**
 * File Upload utility for Supabase Storage
 *
 * Handles uploading files to a Supabase Storage bucket,
 * generating signed URLs, and managing attachments.
 */

import { supabase } from './supabase';

const BUCKET_NAME = 'request-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'application/zip', 'application/x-rar-compressed',
  'application/dwg', 'image/vnd.dwg',
];

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file before upload
 */
export function validateFile(file: File): FileValidation {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
  }

  // Allow all types but warn for unknown ones
  if (ALLOWED_TYPES.length > 0 && !ALLOWED_TYPES.includes(file.type) && file.type !== '') {
    // Still allow, just note it
    console.warn(`File type ${file.type} is not in the standard allowed list but will be uploaded.`);
  }

  return { valid: true };
}

/**
 * Generate a unique storage path for a file
 */
function generatePath(requestId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${requestId}/${timestamp}_${sanitized}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  requestId: string
): Promise<UploadResult> {
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const path = generatePath(requestId, file.name);

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, fall back to base64 storage
      if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
        console.warn('Supabase Storage bucket not configured. Falling back to base64.');
        return await uploadAsBase64(file);
      }
      return { success: false, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return {
      success: true,
      url: urlData.publicUrl,
      path,
    };
  } catch (err) {
    // Fallback to base64 if storage is not available
    console.warn('Storage upload failed, falling back to base64:', err);
    return await uploadAsBase64(file);
  }
}

/**
 * Fallback: Convert file to base64 data URL
 * Used when Supabase Storage is not configured
 */
async function uploadAsBase64(file: File): Promise<UploadResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        success: true,
        url: reader.result as string,
        path: `local/${file.name}`,
      });
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file.' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  requestId: string,
  onProgress?: (index: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const result = await uploadFile(files[i], requestId);
    results.push(result);
  }
  onProgress?.(files.length, files.length);
  return results;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  if (path.startsWith('local/') || path.startsWith('data:')) {
    return { success: true }; // Base64 files are just in memory
  }

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file icon type based on MIME type
 */
export function getFileIconType(mimeType: string): 'image' | 'pdf' | 'doc' | 'spreadsheet' | 'archive' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compress')) return 'archive';
  return 'other';
}
