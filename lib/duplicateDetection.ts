import { RequestItem, RequestStatus } from '../types';

export interface DuplicateMatch {
  request: RequestItem;
  score: number;
  reason: string;
}

/**
 * Tokenize a string into lowercase words (letters/numbers only).
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().match(/[a-z0-9]+/g) || []
  );
}

/**
 * Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find potential duplicate requests based on description similarity,
 * UNSPSC code match, and key attribute overlap.
 */
export function findPotentialDuplicates(
  formData: Partial<RequestItem>,
  existingRequests: RequestItem[],
  editingId?: string
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const description = formData.generatedDescription || formData.shortDescription || '';
  if (!description && !formData.unspscCode) return matches;

  const formTokens = tokenize(description);

  for (const req of existingRequests) {
    // Skip the request being edited
    if (editingId && req.id === editingId) continue;
    // Skip cancelled/rejected requests
    if (req.status === RequestStatus.CANCELLED || req.status === RequestStatus.REJECTED) continue;

    let score = 0;
    const reasons: string[] = [];

    // 1. Description similarity (weight: 0.6)
    if (formTokens.size > 0) {
      const reqDesc = req.generatedDescription || req.title || '';
      const reqTokens = tokenize(reqDesc);
      const descSim = jaccardSimilarity(formTokens, reqTokens);
      if (descSim > 0.3) {
        score += descSim * 0.6;
        reasons.push(`Description ${Math.round(descSim * 100)}% similar`);
      }
    }

    // 2. UNSPSC code exact match (weight: 0.25)
    if (formData.unspscCode && req.unspscCode && formData.unspscCode === req.unspscCode) {
      score += 0.25;
      reasons.push('Same UNSPSC code');
    }

    // 3. Key attribute overlap (weight: 0.15)
    if (formData.attributes && req.attributes) {
      const formAttrs = formData.attributes;
      const reqAttrs = req.attributes;
      let attrMatches = 0;
      let attrTotal = 0;
      for (const key of Object.keys(formAttrs)) {
        const fVal = String(formAttrs[key] || '').toLowerCase().trim();
        const rVal = String(reqAttrs[key] || '').toLowerCase().trim();
        if (fVal) {
          attrTotal++;
          if (fVal === rVal) attrMatches++;
        }
      }
      if (attrTotal > 0 && attrMatches > 0) {
        const attrSim = attrMatches / attrTotal;
        score += attrSim * 0.15;
        if (attrSim > 0.5) reasons.push(`${attrMatches}/${attrTotal} attributes match`);
      }
    }

    // Threshold: only include if score > 0.35
    if (score > 0.35 && reasons.length > 0) {
      matches.push({ request: req, score, reason: reasons.join(', ') });
    }
  }

  // Sort by score descending, limit to top 5
  return matches.sort((a, b) => b.score - a.score).slice(0, 5);
}
