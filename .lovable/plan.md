

## Problem

The "Закупівля сировини" (RAW_MATERIAL) option in the purchase type selector is visible to all roles. Per the memory note, during development it's restricted to `admin` only. The user now wants to grant access to two additional roles: `financial_analyst` and `foreign_trade_manager`.

## Solution

Add role-based visibility for the RAW_MATERIAL select option in `NewPurchaseRequest.tsx`. Only `admin`, `financial_analyst`, and `foreign_trade_manager` should see and select the "Закупівля сировини" option.

### Changes

**`src/pages/purchase/NewPurchaseRequest.tsx`**:
- Import `useAuth` (already imported) and get `profile` from it
- Define a constant array of roles allowed to create raw material invoices: `['admin', 'financial_analyst', 'foreign_trade_manager']`
- Conditionally render the `<SelectItem value="RAW_MATERIAL">` only when `profile?.role` is in that array
- If user somehow has `purchaseType === 'RAW_MATERIAL'` but doesn't have the role, reset to `'TMC'`

This is a UI-level guard. The database RLS policies on `raw_material_invoices` should also be checked to ensure these roles can insert — but that's a separate concern if the RLS was set up for `admin` only during migration.

### Technical details

The `useAuth` hook is already imported and `user` is destructured. We just need to also destructure `profile` and add a role check around the RAW_MATERIAL select item (line 190).

