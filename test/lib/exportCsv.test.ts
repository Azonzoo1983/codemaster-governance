import { exportToCsv } from '../../lib/exportCsv';

describe('exportToCsv', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let lastCreatedLink: HTMLAnchorElement | null;

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => 'blob:mock-url');
    revokeObjectURLMock = vi.fn();
    lastCreatedLink = null;

    // Mock URL methods
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    // Mock document.createElement to intercept the <a> element
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        lastCreatedLink = el as HTMLAnchorElement;
        // Replace click with a no-op so we don't trigger navigation
        el.click = vi.fn();
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a CSV blob, triggers download, and revokes the URL', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    exportToCsv(data, 'users');

    // Should have created an object URL from a Blob
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLMock.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);

    // Should trigger a click to download
    expect(lastCreatedLink).not.toBeNull();
    expect(lastCreatedLink!.click).toHaveBeenCalledTimes(1);

    // Should revoke the URL after download
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('does nothing when given an empty array', () => {
    exportToCsv([], 'empty');

    expect(createObjectURLMock).not.toHaveBeenCalled();
    expect(lastCreatedLink).toBeNull();
  });

  it('sets the correct download filename', () => {
    const data = [{ id: 1 }];

    exportToCsv(data, 'report');

    expect(lastCreatedLink).not.toBeNull();
    expect(lastCreatedLink!.download).toBe('report.csv');
  });
});
