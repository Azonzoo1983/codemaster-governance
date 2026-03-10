# Item/Service Attribute Configurator

## Summary

Split the attribute configurator so admins can control which attributes appear for Items vs Services. Uses per-attribute toggles with filter tabs in the Admin panel.

## Approach

**Tabbed filter view + per-attribute Item/Service checkboxes.** One shared attribute pool with visibility controls. The existing `visibleForClassification` field already supports this — we expose it in the Admin UI.

## Data Model

No schema changes. Existing field on `AttributeDefinition`:

```typescript
visibleForClassification?: Classification[];  // ['Item'], ['Service'], or ['Item','Service']
```

- `['Item']` → Item only
- `['Service']` → Service only
- `['Item', 'Service']` or `undefined` → Both (backward compatible)

## Admin Panel Changes

### Filter Tabs
Three tabs above the attribute table: **All** (default) | **Item** | **Service**. Filters the table rows by classification visibility.

### Table
New "Visible For" column showing badges: `Item`, `Service`, or `Both`.

### Add/Edit Form
Two checkboxes added:
- "Show for Items" (default: checked)
- "Show for Services" (default: checked)

Validation: at least one must be checked.

## NewRequest Form

No changes needed. `relevantAttributes` already filters by `formData.classification` (lines 154-161 of NewRequest.tsx).

## Auto-Generated Description

No changes needed. Already uses `relevantAttributes` which is classification-filtered.

## Default Attribute Assignments

**Item-specific:** Size & Dimensions, Part Number, Material Grade, Weight, Color, Surface Finish, Shelf Life, Machine/Equipment, Drawings Available, Origin

**Service-specific:** Scope of Work, Duration, Frequency, Qualifications, Deliverables

**Both:** Brand, Certifications, Standards, Warranty, Operating Conditions, UOM

## Files to Modify

1. `pages/Admin.tsx` — Add filter tabs, "Visible For" column, Item/Service checkboxes in add/edit form
2. `types.ts` — Add service-specific default attributes to MOCK_ATTRIBUTES

## Files Unchanged

- `stores/adminStore.ts` — No store changes needed
- `components/DynamicForm.tsx` — No rendering changes
- `pages/NewRequest.tsx` — Already filters by classification
