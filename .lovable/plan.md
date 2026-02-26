

## Problem

The `validate` function in `RawMaterialInvoiceForm.tsx` enforces supplier selection and at least one valid item for both draft saves and submission. The user expects drafts to be savable with incomplete data.

## Solution

Split validation: when `submitForApproval` is `false` (draft save), skip all mandatory field checks. Only enforce full validation when submitting for approval.

### Changes

**`src/components/purchase/RawMaterialInvoiceForm.tsx`** — modify `validate` function (and `handleSave`):
- When `submitForApproval === false`: no validation at all, allow saving with empty supplier/items.
- When `submitForApproval === true`: keep existing checks (supplier, items, supplier invoice PDF).
- In `handleSave`: make supplier fields optional for drafts (use empty strings if no supplier selected). Filter valid items but allow zero items for drafts.

