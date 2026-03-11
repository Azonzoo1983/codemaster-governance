/**
 * Bulk Upload Helpers
 *
 * Centralizes the mapping between flat Excel columns and the structured
 * `attributes` Record on RequestItem.  Used by:
 *   - BulkUpload.tsx  (template generation + file parsing)
 *   - DraftManager.tsx (draft completeness validation)
 */

import {
  AttributeDefinition,
  AttributeType,
  Classification,
  MaterialSubType,
  ServiceSubType,
} from '../types';

// ────────────────── Types ──────────────────

export interface ExcelColumn {
  header: string;
  /** Which attribute this column maps to (empty string for base columns like Title, Project) */
  attrId: string;
  /** For complex types: dimension field name, or 'value'/'unit' for NUMERIC_UNIT */
  subField?: string;
  mandatory: boolean;
  /** If present, generates an Excel data-validation dropdown */
  dataValidation?: string[];
  /** Whether this is a "base" column (Title, Sub-Type, etc.) vs an attribute column */
  isBase?: boolean;
  /** Column width hint */
  width?: number;
}

// ────────────────── Constants ──────────────────

const ITEM_SUB_TYPES = Object.values(MaterialSubType);
const SERVICE_SUB_TYPES = Object.values(ServiceSubType);

const ITEM_UOMS = [
  'Each', 'Set', 'Box', 'Pair', 'Meter', 'mm', 'Roll', 'Sheet', 'Piece',
  'kg', 'g', 'Liter', 'Gallon', 'Drum', 'Bag', 'Bundle', 'Case', 'Pack',
  'Ton', 'Foot', 'Inch',
];

const SERVICE_UOMS = [
  'Days', 'Hours', 'Lumpsum', 'Each', 'Monthly', 'Weekly', 'Per Visit', 'Per Unit',
];

const DIMENSION_UNITS = ['mm', 'cm', 'm', 'inches', 'feet'];

// ────────────────── Column Builder ──────────────────

/**
 * Build the ordered list of Excel columns for a given classification.
 * Includes base columns (Title, Sub-Type, etc.) followed by attribute columns.
 */
export function buildColumnsForSheet(
  allAttributes: AttributeDefinition[],
  classification: Classification,
): ExcelColumn[] {
  const isItem = classification === Classification.ITEM;

  // --- Base columns ---
  const baseColumns: ExcelColumn[] = [
    { header: 'Title', attrId: '', mandatory: true, isBase: true, width: 30 },
    {
      header: 'Sub-Type',
      attrId: '',
      mandatory: false,
      isBase: true,
      width: 22,
      dataValidation: isItem ? ITEM_SUB_TYPES : SERVICE_SUB_TYPES,
    },
    { header: 'Description', attrId: '', mandatory: false, isBase: true, width: 40 },
    { header: 'Project', attrId: '', mandatory: true, isBase: true, width: 20 },
    { header: 'UNSPSC Code', attrId: '', mandatory: false, isBase: true, width: 16 },
    {
      header: 'UOM',
      attrId: '',
      mandatory: false,
      isBase: true,
      width: 14,
      dataValidation: isItem ? ITEM_UOMS : SERVICE_UOMS,
    },
  ];

  // --- Filter relevant attributes ---
  const relevant = allAttributes
    .filter(
      (a) =>
        a.active &&
        a.visibleForClassification?.includes(classification) &&
        (a.mandatory || a.includeInAutoDescription),
    )
    .sort((a, b) => a.descriptionOrder - b.descriptionOrder);

  // --- Expand attributes into columns ---
  const attrColumns: ExcelColumn[] = [];

  for (const attr of relevant) {
    switch (attr.type) {
      case AttributeType.TEXT:
      case AttributeType.LONG_TEXT:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          mandatory: attr.mandatory,
          width: attr.type === AttributeType.LONG_TEXT ? 40 : 25,
        });
        break;

      case AttributeType.DROPDOWN:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          mandatory: attr.mandatory,
          dataValidation: attr.options || [],
          width: 20,
        });
        break;

      case AttributeType.MULTI_SELECT:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          mandatory: attr.mandatory,
          width: 30,
        });
        break;

      case AttributeType.NUMERIC:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          mandatory: attr.mandatory,
          width: 15,
        });
        break;

      case AttributeType.NUMERIC_UNIT:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          subField: 'value',
          mandatory: attr.mandatory,
          width: 15,
        });
        attrColumns.push({
          header: `${attr.name} (Unit)`,
          attrId: attr.id,
          subField: 'unit',
          mandatory: false,
          dataValidation: attr.units || [],
          width: 14,
        });
        break;

      case AttributeType.DIMENSION_BLOCK: {
        const fields = attr.dimensionFields || [];
        for (const field of fields) {
          attrColumns.push({
            header: `Dim: ${field}`,
            attrId: attr.id,
            subField: field,
            mandatory: false, // Individual dims are optional; at least one needed
            width: 14,
          });
        }
        attrColumns.push({
          header: 'Dim: Unit',
          attrId: attr.id,
          subField: '_unit',
          mandatory: false,
          dataValidation: DIMENSION_UNITS,
          width: 12,
        });
        break;
      }

      case AttributeType.DATE:
        attrColumns.push({
          header: attr.name,
          attrId: attr.id,
          mandatory: attr.mandatory,
          width: 16,
        });
        break;
    }
  }

  return [...baseColumns, ...attrColumns];
}

// ────────────────── Row Parser ──────────────────

/** Safe string conversion — handles numbers, nulls, etc. from SheetJS */
export const toStr = (v: unknown): string => (v == null ? '' : String(v)).trim();

/**
 * Given a flat Excel row and the column definitions, reconstruct the
 * structured `attributes` Record for a RequestItem.
 */
export function parseRowAttributes(
  row: Record<string, unknown>,
  columns: ExcelColumn[],
  allAttributes: AttributeDefinition[],
): Record<string, string | number | string[] | Record<string, string | number>> {
  const attrs: Record<string, string | number | string[] | Record<string, string | number>> = {};

  // Group attribute columns by attrId
  const attrColumns = columns.filter((c) => c.attrId && !c.isBase);
  const grouped = new Map<string, ExcelColumn[]>();
  for (const col of attrColumns) {
    if (!grouped.has(col.attrId)) grouped.set(col.attrId, []);
    grouped.get(col.attrId)!.push(col);
  }

  for (const [attrId, cols] of grouped) {
    const attrDef = allAttributes.find((a) => a.id === attrId);
    if (!attrDef) continue;

    switch (attrDef.type) {
      case AttributeType.TEXT:
      case AttributeType.LONG_TEXT:
      case AttributeType.DROPDOWN:
      case AttributeType.DATE: {
        const val = toStr(row[cols[0].header]);
        if (val) attrs[attrId] = val;
        break;
      }

      case AttributeType.NUMERIC: {
        const val = toStr(row[cols[0].header]);
        if (val) attrs[attrId] = val;
        break;
      }

      case AttributeType.MULTI_SELECT: {
        const raw = toStr(row[cols[0].header]);
        if (raw) {
          const values = raw.split(',').map((s) => s.trim()).filter(Boolean);
          if (values.length > 0) attrs[attrId] = values;
        }
        break;
      }

      case AttributeType.NUMERIC_UNIT: {
        const valueCol = cols.find((c) => c.subField === 'value');
        const unitCol = cols.find((c) => c.subField === 'unit');
        const val = toStr(row[valueCol?.header || '']);
        const unit = toStr(row[unitCol?.header || '']);
        if (val) {
          attrs[attrId] = { value: val, unit: unit || '' };
        }
        break;
      }

      case AttributeType.DIMENSION_BLOCK: {
        const dimObj: Record<string, string | number> = {};
        let hasAnyValue = false;
        for (const col of cols) {
          const val = toStr(row[col.header]);
          const key = col.subField || col.header;
          dimObj[key] = val;
          if (val && key !== '_unit') hasAnyValue = true;
        }
        if (hasAnyValue) {
          attrs[attrId] = dimObj;
        }
        break;
      }
    }
  }

  return attrs;
}

// ────────────────── Completeness Validation ──────────────────

export interface MissingField {
  attrId: string;
  attrName: string;
}

/**
 * Return the list of mandatory attributes that are missing or empty
 * for a given classification and attributes record.
 */
export function getMissingMandatoryAttributes(
  classification: Classification | string,
  attributes: Record<string, unknown> | undefined,
  allAttributeDefs: AttributeDefinition[],
): MissingField[] {
  const classEnum =
    classification === 'Item' || classification === Classification.ITEM
      ? Classification.ITEM
      : Classification.SERVICE;

  const mandatory = allAttributeDefs.filter(
    (a) =>
      a.mandatory &&
      a.active &&
      a.visibleForClassification?.includes(classEnum),
  );

  const missing: MissingField[] = [];
  const attrs = attributes || {};

  for (const attr of mandatory) {
    const val = (attrs as Record<string, unknown>)[attr.id];

    let isFilled = false;

    switch (attr.type) {
      case AttributeType.TEXT:
      case AttributeType.LONG_TEXT:
      case AttributeType.DROPDOWN:
      case AttributeType.DATE:
        isFilled = typeof val === 'string' && val.trim() !== '';
        break;

      case AttributeType.NUMERIC:
        isFilled = val != null && String(val).trim() !== '';
        break;

      case AttributeType.MULTI_SELECT:
        isFilled = Array.isArray(val) && val.length > 0;
        break;

      case AttributeType.NUMERIC_UNIT: {
        const obj = val as Record<string, unknown> | undefined;
        isFilled = obj != null && obj.value != null && String(obj.value).trim() !== '';
        break;
      }

      case AttributeType.DIMENSION_BLOCK: {
        // At least one dimension field must have a value
        const obj = val as Record<string, unknown> | undefined;
        if (obj) {
          isFilled = Object.entries(obj).some(
            ([k, v]) => k !== '_unit' && String(v || '').trim() !== '',
          );
        }
        break;
      }
    }

    if (!isFilled) {
      missing.push({ attrId: attr.id, attrName: attr.name });
    }
  }

  return missing;
}

/**
 * Convenience: are all mandatory attributes filled for this draft?
 */
export function isDraftComplete(
  classification: Classification | string,
  attributes: Record<string, unknown> | undefined,
  allAttributeDefs: AttributeDefinition[],
): boolean {
  return getMissingMandatoryAttributes(classification, attributes, allAttributeDefs).length === 0;
}
