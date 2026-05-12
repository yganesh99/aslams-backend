# File handling in production

This document describes how uploaded files are stored, exposed over HTTP, and what to configure when deploying the Aslams ERP API.

## Overview

The API uses **multer** with **disk storage**. Files are written under a configurable root directory, organized by subdirectory (`products`, `invoices`, etc.). Public HTTP access is intended via the **`/uploads`** path on the same host as the API.

Clients (e.g. the ERP Next.js app) must resolve stored paths against the **API base URL**, not the frontend origin, because values like `/uploads/products/...` are path-only URLs.

## Upload middleware

Implementation: `src/middlewares/upload.js`

| Setting | Value |
|--------|--------|
| **Root directory** | `UPLOAD_ROOT` environment variable, or `{process.cwd()}/uploads` if unset |
| **Subdirectories** | Passed to `createUpload(subDir)` — e.g. `products`, `invoices` |
| **Naming** | `{timestamp}-{random}{originalExtension}` |
| **Allowed MIME types** | `image/jpeg`, `image/png`, `application/pdf` |
| **Max file size** | 5 MB per file |
| **Max files (multer instance)** | 5 (per request where `array` is used) |

The middleware ensures `UPLOAD_ROOT` exists on load and creates each subdirectory with `fs.mkdirSync(..., { recursive: true })` when the upload factory runs.

## HTTP static serving

Implementation: `src/app.js` — uses **`UPLOAD_ROOT`** from `src/middlewares/upload.js` (exported as `createUpload.UPLOAD_ROOT`), same as multer, so writes and `GET /uploads/*` always refer to the same tree.

```text
GET /uploads/* → express.static(UPLOAD_ROOT)
```

If `UPLOAD_ROOT` is unset, it defaults to `{process.cwd()}/uploads`.

## Features that use uploads

### Product images

- **Route:** `POST /api/products/:id/image` (multipart field name: `image`)
- **Remove:** `DELETE /api/products/:id/images/:filename` (basename only, e.g. `1699….png`) — updates `Product.images` / `Product.image`, deletes the file from disk, and writes an audit log entry `delete_image`.
- **Storage:** `{UPLOAD_ROOT}/products/`
- **Persisted in MongoDB:** `Product.image` and entries in `Product.images` as **public paths**, e.g. `/uploads/products/1699….png`
- **Serving:** `GET https://<api-host>/uploads/products/<filename>`

### Supplier invoice attachments

- **Route:** `POST /api/supplier-invoices/:id/attachments` (multipart field: `files`, up to 5)
- **Storage:** `{UPLOAD_ROOT}/invoices/`
- **Persisted in MongoDB:** Each attachment includes `filename`, `originalName`, `mimeType`, `size`, and **`path`** — the latter is the **absolute filesystem path** returned by multer (e.g. `/data/uploads/invoices/...`), not a URL. Any UI that needs a browser link must map filenames to a documented download route or to `/uploads/...` if you choose to expose them that way.

Deletion: `DELETE /api/supplier-invoices/:id/attachments/:filename` removes the DB entry and deletes the file using the stored `path`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `UPLOAD_ROOT` | Optional. Base directory for all multer disk writes. Subfolders (`products`, `invoices`) are created under it. |
| `CORS_ORIGIN` | If the browser loads files via XHR/fetch from another origin, CORS must allow that origin. `<img src="https://api.../uploads/...">` does not use CORS, but **Helmet’s `Cross-Origin-Resource-Policy`** must not be `same-origin` if the ERP UI is on a different host/port than the API. This codebase sets **`cross-origin`** so images load in the ERP. |

There is no separate “public URL base” env on the server: clients are expected to use their configured API origin + the stored path (for product images).

## Production checklist

1. **Persistent disk** — Attach a volume (or equivalent) so uploads survive restarts. Set `UPLOAD_ROOT` to that mount path on the server (e.g. `/data/uploads`); static `/uploads` uses the same root.
2. **Single writable location** — Multiple API instances must share the same upload store, or use shared object storage (S3, etc.) — not implemented in this codebase; today assumes shared disk or a single node.
3. **Backups** — Include the upload directory in backup strategy alongside the database.
4. **Frontend** — Set `NEXT_PUBLIC_API_URL` (or equivalent) so path-only `/uploads/...` values resolve to `https://<api-host>/uploads/...`.
5. **Reverse proxy** — You may map `/uploads` on the API host through nginx/Caddy to the Node process as today, or terminate at a CDN/object store if you migrate storage later.

## Related source files

- `src/middlewares/upload.js` — multer factory
- `src/app.js` — `/uploads` static mount
- `src/controllers/productController.js` — `uploadImage`
- `src/routes/product.routes.js` — `POST /:id/image`
- `src/controllers/supplierInvoiceController.js` — `uploadAttachments`, `removeAttachment`
- `src/services/supplierInvoice.service.js` — attachment paths and `unlinkSync`
- `src/models/product.model.js` — `image`, `images`
- `src/models/supplierInvoice.model.js` — `attachments`

## Not file uploads

Report CSV exports in `reportingController` are generated in memory and sent as download responses; they are not stored under `uploads/`.
