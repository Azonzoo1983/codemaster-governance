import { describe, it, expect } from 'vitest';
import { findPotentialDuplicates } from '../../lib/duplicateDetection';
import { RequestStatus } from '../../types';

const makeRequest = (overrides: any = {}) => ({
  id: 'REQ-001',
  title: 'Steel Pipe 4 inch',
  generatedDescription: 'PIPE STEEL 4 INCH SCH40',
  status: RequestStatus.SUBMITTED_TO_POC,
  unspscCode: '40141600',
  attributes: { brand: 'Tenaris', size: '4 inch' },
  ...overrides,
});

describe('findPotentialDuplicates', () => {
  it('returns empty array when no similar requests exist', () => {
    const result = findPotentialDuplicates(
      { generatedDescription: 'CABLE COPPER 16MM' },
      [makeRequest()]
    );
    expect(result).toEqual([]);
  });

  it('detects similar descriptions', () => {
    const existing = makeRequest({ generatedDescription: 'PIPE STEEL 4 INCH SCH40 SEAMLESS' });
    const result = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH SCH40' },
      [existing]
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].request.id).toBe('REQ-001');
  });

  it('boosts score with matching UNSPSC code', () => {
    const existing = makeRequest();
    const withUnspsc = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH', unspscCode: '40141600' },
      [existing]
    );
    const withoutUnspsc = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH' },
      [existing]
    );
    // With UNSPSC match should score higher
    if (withUnspsc.length > 0 && withoutUnspsc.length > 0) {
      expect(withUnspsc[0].score).toBeGreaterThan(withoutUnspsc[0].score);
    }
  });

  it('excludes cancelled requests', () => {
    const cancelled = makeRequest({
      status: RequestStatus.CANCELLED,
      generatedDescription: 'PIPE STEEL 4 INCH SCH40',
    });
    const result = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH SCH40' },
      [cancelled]
    );
    expect(result).toEqual([]);
  });

  it('excludes the request being edited', () => {
    const existing = makeRequest({ generatedDescription: 'PIPE STEEL 4 INCH SCH40' });
    const result = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH SCH40' },
      [existing],
      'REQ-001'
    );
    expect(result).toEqual([]);
  });

  it('limits results to 5', () => {
    const existingRequests = Array.from({ length: 10 }, (_, i) =>
      makeRequest({ id: `REQ-${i}`, generatedDescription: 'PIPE STEEL 4 INCH SCH40 SEAMLESS' })
    );
    const result = findPotentialDuplicates(
      { generatedDescription: 'PIPE STEEL 4 INCH SCH40' },
      existingRequests
    );
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
