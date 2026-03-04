import { validateFile, formatFileSize, getFileIconType } from '../../lib/fileUpload';

/**
 * Helper to create a mock File object with the given size and type.
 */
function createMockFile(name: string, size: number, type: string): File {
  // Create a buffer of the desired size (only allocate a small actual buffer)
  const content = new ArrayBuffer(Math.min(size, 64));
  const file = new File([content], name, { type });

  // Override the size property since the File constructor uses the actual buffer size
  Object.defineProperty(file, 'size', { value: size, writable: false });

  return file;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, must match source constant

describe('validateFile', () => {
  it('accepts a valid file within the size limit', () => {
    const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects a file that exceeds the maximum size', () => {
    const file = createMockFile('large.zip', MAX_FILE_SIZE + 1, 'application/zip');
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File too large');
  });

  it('accepts a file with a non-standard MIME type (with a console warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = createMockFile('data.bin', 1024, 'application/octet-stream');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('accepts a file exactly at the size limit', () => {
    const file = createMockFile('exact.pdf', MAX_FILE_SIZE, 'application/pdf');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a file with an empty MIME type without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = createMockFile('unknown', 512, '');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    // Empty type should not trigger the warning because of the file.type !== '' check
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('getFileIconType', () => {
  it('returns "image" for image MIME types', () => {
    expect(getFileIconType('image/png')).toBe('image');
    expect(getFileIconType('image/jpeg')).toBe('image');
  });

  it('returns "pdf" for PDF files', () => {
    expect(getFileIconType('application/pdf')).toBe('pdf');
  });

  it('returns "doc" for Word documents', () => {
    expect(getFileIconType('application/msword')).toBe('doc');
  });

  it('returns "spreadsheet" for Excel and CSV files', () => {
    expect(getFileIconType('application/vnd.ms-excel')).toBe('spreadsheet');
    expect(getFileIconType('text/csv')).toBe('spreadsheet');
  });

  it('returns "archive" for zip files', () => {
    expect(getFileIconType('application/zip')).toBe('archive');
  });

  it('returns "other" for unknown types', () => {
    expect(getFileIconType('application/octet-stream')).toBe('other');
  });
});
