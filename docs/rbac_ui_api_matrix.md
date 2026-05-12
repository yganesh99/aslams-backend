# RBAC: UI sections vs API routes (single-tenant)

Canonical section defaults: [src/services/rolePermission.service.js](../src/services/rolePermission.service.js).  
ERP nav filters on `allowedSections` from `GET /auth/me`. API enforcement uses `auth([roles])` on each router.

| Role | Sections (defaults) | Notable API alignment |
|------|---------------------|------------------------|
| admin | all | Full access to mutating routes |
| store_manager | dashboard, inventory.\*, supplier-invoices, stores, **reports**, **sales** | `/api/reports/*`, `/api/orders`, PO, supplier invoices, `GET /api/stores`; store **mutations** admin-only |
| inventory_manager | dashboard, inventory (incl. PO), no supplier-invoices | Same as store_manager for inventory + PO; supplier-invoices section **not** granted by default |
| accountant | dashboard, supplier-invoices, sales, accounts, reports | `/api/reports/*`, `/api/supplier-invoices/*`; no inventory write routes |
| cashier | pos.\* only (no ERP shell) | `/api/orders` list requires `sessionId` (own register session); order read/invoice scoped to that session; customers list requires search ≥2 chars; `GET /api/stores` allowed for POS |

When changing either `DEFAULT_PERMISSIONS` or route `auth([...])` arrays, update this table and verify ERP `SectionGuard` / nav in `erp-app`.
