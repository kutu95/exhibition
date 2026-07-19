# Image and fulfilment workflow

End-to-end reference for preparing exhibition prints for the website, taking orders, and producing lab-ready files for Pixel Perfect.

## Overview

```mermaid
flowchart LR
  subgraph prep [Preparation]
    TIFF[Master TIFF in MASTER_FILES_DIR]
    WEB[Web JPEG in public/images]
    DB[(Product + variants + master_filename)]
    TIFF --> WEB
    TIFF --> DB
    WEB --> DB
  end

  subgraph shop [Shop]
    PAGE[Shop / product page]
    CHECKOUT[Stripe Checkout]
    PAGE --> CHECKOUT
  end

  subgraph order [Order]
    OI[order_items awaiting_file]
    CHECKOUT --> OI
  end

  subgraph print [Print pipeline]
    WORKER[fulfilment_worker.py]
    DRIVE[Google Drive or local output]
    LAB[Pixel Perfect - manual]
    OI --> WORKER
    WORKER --> DRIVE
    DRIVE --> LAB
  end

  DB --> PAGE
```

| Stage | Who / what | Output |
|-------|------------|--------|
| Register photo | Admin UI or PhotoLab API | Product, variants, web image, Stripe prices |
| Browse & buy | Customer on site | Paid `order_items` |
| Auto print prep | Python worker | Sized Adobe RGB JPEG + `file_ready` |
| Lab & ship | Admin fulfilment dashboard | Pixel Perfect ref, tracking, emails |

---

## 1. Preparing an image for the website and shop

Customers see a **web JPEG** (`product_images.image_url`, typically `/images/...`). Print production always uses the **master TIFF** referenced by `product_variants.master_filename`.

### Master files

- Stored under **`MASTER_FILES_DIR`** (Mac: `/Volumes/AppData/Exhibition/Masters`; server: `/mnt/nas/AppData/Exhibition/Masters`).
- Dev may use **`MASTER_FILES_DIR_DEV`** when `NODE_ENV` is not `production`.
- Filename only in the database (e.g. `photo-name.tif`) — no paths. Valid extensions: `.tif`, `.tiff`.
- Masters should include an **embedded ICC profile** (required later for the print worker).

See `lib/master-files.ts` for listing and validation used by Register Photo.

### Path A: Import Wizard (guided, recommended)

| Step | Detail |
|------|--------|
| UI | `/admin/import-wizard` |
| API | `POST /api/admin/register-photo` (same as Register Photo) |
| Client | `components/admin/ImportPhotoWizardClient.tsx` |

Hard-gated steps from placing a master TIFF in `MASTER_FILES_DIR` (no browser TIFF upload) through details, print templates, web image, and publish. Ends with a product online and ready for ordering. Keep going only when the current step’s completion rules pass. Admin help for preparing masters: `/admin/help/master-tiff`.

### Path A2: Register Photo (single-screen form)

| Step | Detail |
|------|--------|
| UI | `/admin/register-photo` |
| API | `POST /api/admin/register-photo` |
| Client | `components/admin/RegisterPhotoClient.tsx` |

Workflow:

1. Choose a master TIFF from the scanned `MASTER_FILES_DIR` list.
2. Enter title, slug, edition size, metadata, and select **variant templates** (print sizes/prices).
3. **Web image** — one of:
   - **Generate from master:** `lib/web-image-generation.ts` runs `worker/generate_web_image.py` (sRGB, EXIF-aware, max edge 2400px, JPEG quality 90).
   - **Upload:** JPEG/PNG/WebP up to 8MB.
4. File is written under **`public/images/{slug}-{uuid}.jpg`** (or uploaded extension) and recorded in **`media_files`**.
5. **`registerPrintProduct()`** (`lib/product-registration.ts`):
   - Inserts `products` (`product_type: print`, `is_available: true`)
   - Inserts `product_variants` by **copying active `variant_templates`** (width/height mm, border, paper, `print_dpi`, pricing, etc.) and sets **`master_filename`** on each variant
   - Inserts primary `product_images`
   - Creates **Stripe** product + price per variant and stores `stripe_price_id`

### Path B: PhotoLab / API registration

| API | `POST /api/products/register` |
| Auth | Bearer API key (`lib/api-key-auth.ts`) |

Same `registerPrintProduct()` as above, but the caller supplies **`web_image_url`** (already hosted). No automatic web generation on this route.

### Path C: Manual product editor

| UI | `/admin/products/new`, `/admin/products/[id]/edit` |
| Form | `components/admin/ProductEditorForm.tsx` |

Create or edit products and variants manually. Each variant can pick a **print template** to pre-fill fulfilment fields. Shop images may be added via **`POST /api/admin/upload/image`** (site/marketing images, max 5MB). For print fulfilment, variants must still have **`master_filename`** and print dimensions populated.

### What is stored where

| Asset | Role | Location |
|-------|------|----------|
| Master TIFF | Source for web gen + print worker | `MASTER_FILES_DIR` on disk |
| Web JPEG | Shop and product pages | `public/images/...` (+ optional `media_files`) |
| Variant row | Price, dimensions, paper, DPI, **`master_filename`** | `exhibition.product_variants` |
| Templates | Reusable size/price presets | `exhibition.variant_templates` |

The public site **does not** serve master TIFFs to shoppers.

---

## 2. Website display

- Shop listing: `/shop` — products where `is_available` is true.
- Product detail: `/shop/[slug]` — `components/ProductDetailClient.tsx` uses `product_images[0]` and variant selector.
- Images are served as static files from `/images/...` (and similar paths under `public/`).

Supabase clients use schema **`exhibition`** for product data.

---

## 3. Customer ordering

```mermaid
sequenceDiagram
  participant Customer
  participant Shop as ProductDetailClient
  participant API as /api/checkout
  participant Stripe
  participant Webhook as stripe webhook
  participant DB as Postgres

  Customer->>Shop: Select variant, Checkout
  Shop->>API: POST variant_id, quantity
  API->>Stripe: Create Checkout Session
  Stripe-->>Customer: Pay
  Stripe->>Webhook: checkout.session.completed
  Webhook->>DB: orders + order_items
  Note over DB: fulfilment_status = awaiting_file
  Webhook->>DB: assignEditionsToOrder
  Webhook->>Customer: Order confirmation email
```

1. Customer chooses a variant and starts checkout → **`POST /api/checkout`** (`app/api/checkout/route.ts`).
2. Redirect to **Stripe Checkout**; payment completes on Stripe.
3. **`app/api/webhooks/stripe/route.ts`** handles `checkout.session.completed`:
   - Creates **`orders`** (`status: paid`)
   - Creates **`order_items`** with **`fulfilment_status: 'awaiting_file'`**
   - Runs edition assignment
   - Sends **order confirmation** via Resend (`lib/emails/order-confirmation.ts`)

**Manual orders:** `POST /api/admin/orders/manual` also creates items in `awaiting_file`.

At this point **no print file exists yet** — only the database row and Stripe payment.

---

## 4. Print preparation (automated worker)

Print files are **not** generated inside Next.js at checkout. A **separate Python process** polls the fulfilment API.

### Configuration

See **`worker/README.md`**. Typical production env:

```bash
EXHIBITION_API_BASE_URL=https://exhibition.margies.app
EXHIBITION_API_KEY=...
MASTER_FILES_DIR=/mnt/nas/AppData/Exhibition/Masters
PRINT_OUTPUT_PROFILE_PATH=/path/to/AdobeRGB1998.icc
LOCAL_OUTPUT_DIR=/mnt/nas/AppData/Exhibition/print-output
GOOGLE_APPLICATION_CREDENTIALS=...   # optional: create per-order Drive folder
GOOGLE_DRIVE_FOLDER_ID=...           # optional
```

`LOCAL_OUTPUT_DIR` is required. Drive credentials are optional and only create an empty per-order folder; the JPEG is uploaded manually.

`WORKER_POLL_SECONDS` defaults to 60.

Run locally with app: `npm run dev:all` (Next.js + worker).

### Worker loop (`worker/fulfilment_worker.py`)

1. **`GET /api/fulfilment/queue`** — authenticated with API key; returns items with variant/product fields including **`master_filename`**, **`width_mm`**, **`height_mm`**, **`border_mm`**, **`print_dpi`**.
2. For each item with **`fulfilment_status === 'awaiting_file'`**:
   - Resolve `MASTER_FILES_DIR / master_filename`
   - **`generate_print_file()`**:
     - Requires embedded ICC in the TIFF
     - Converts to **Adobe RGB 1998** using `PRINT_OUTPUT_PROFILE_PATH` (perceptual intent, black-point compensation)
     - Resizes/fits to print area at variant DPI; optional white border
     - Writes a high-quality JPEG with output ICC embedded
   - Copy JPEG to **`LOCAL_OUTPUT_DIR`**
   - Optionally create **one** Google Drive folder (no file upload; reuse existing folder id if already stored)
   - **`PATCH /api/fulfilment/items/{order_item_id}`** → **`fulfilment_status: 'file_ready'`**, plus `cloud_file_url` / `cloud_folder_path`

Queue and updates: `lib/fulfilment-items.ts`, `lib/fulfilment-update.ts`. Admin mirror routes under `/api/admin/fulfilment/`.

### How the worker knows print size

Dimensions come from **`product_variants`** at order time (originally copied from **variant templates** at registration, or set in the product editor). The worker does not read templates directly — it reads the queue row built from the ordered variant.

---

## 5. Lab submission and shipping (manual admin)

**UI:** `/admin/fulfilment` — `components/admin/FulfilmentDashboardClient.tsx`

| Status | Meaning |
|--------|---------|
| `awaiting_file` | Paid; worker should produce upload |
| `file_ready` | Print JPEG available (Drive link or local URI) |
| `submitted_to_lab` | Pixel Perfect order reference saved |
| `shipped` | Tracking recorded; customer may be notified |
| `delivered` | Terminal state |

Typical admin flow:

1. Wait for **`file_ready`** (open `cloud_file_url`).
2. Place order with **Pixel Perfect** (external lab); save **`pixel_perfect_order_ref`** → status **`submitted_to_lab`**.
3. When despatched, set **`tracking_number`** → **`shipped`**; optional **`/api/admin/fulfilment/notify-customer`**.

Paper type, finish, framing, and variant notes are metadata for the lab; colour space for the file is normalized to the configured output profile (normally Adobe RGB 1998).

---

## 6. Fulfilment status lifecycle

```text
awaiting_file → file_ready → submitted_to_lab → shipped → delivered
     ↑              ↑              ↑              ↑
   Stripe        Worker         Admin UI       Admin UI
   webhook       + PATCH        dashboard      dashboard
```

Timestamps: `file_ready_at`, `submitted_to_lab_at`, `shipped_at` (set on status transitions in `lib/fulfilment-update.ts`).

---

## 7. Key files

| Area | Files |
|------|--------|
| Register photo | `app/api/admin/register-photo/route.ts`, `components/admin/RegisterPhotoClient.tsx` |
| API register | `app/api/products/register/route.ts` |
| Product creation | `lib/product-registration.ts` |
| Web JPEG from TIFF | `lib/web-image-generation.ts`, `worker/generate_web_image.py` |
| Masters | `lib/master-files.ts` |
| Checkout | `app/api/checkout/route.ts` |
| Orders | `app/api/webhooks/stripe/route.ts` |
| Fulfilment API | `app/api/fulfilment/queue/route.ts`, `app/api/fulfilment/items/[order_item_id]/route.ts` |
| Print worker | `worker/fulfilment_worker.py`, `worker/README.md` |
| Admin fulfilment | `app/admin/fulfilment/page.tsx`, `components/admin/FulfilmentDashboardClient.tsx` |
| Variant templates | `exhibition.variant_templates`, admin print profiles / templates UI |

---

## 8. Environment variables (summary)

| Variable | Used for |
|----------|----------|
| `MASTER_FILES_DIR` / `MASTER_FILES_DIR_DEV` | Master TIFF location |
| `APP_ROOT` | Resolve `worker/` scripts from Next.js |
| `EXHIBITION_API_BASE_URL`, `EXHIBITION_API_KEY` | Worker ↔ app API |
| `PRINT_OUTPUT_PROFILE_PATH` | Lab output ICC (Adobe RGB 1998) |
| `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_DRIVE_FOLDER_ID` | Print file delivery |
| `LOCAL_OUTPUT_DIR` | Local print output instead of Drive |
| Stripe / Resend vars | Checkout and emails |

---

## Related docs

- [image-and-fulfilment-workflow.pdf](./image-and-fulfilment-workflow.pdf) / [image-and-fulfilment-workflow.docx](./image-and-fulfilment-workflow.docx) — expanded operator guide (print-friendly)
- [supabase-infrastructure.md](./supabase-infrastructure.md) — database host and schema
- [supabase-multi-schema.md](./supabase-multi-schema.md) — exposing schemas to PostgREST

To regenerate the PDF/DOCX after editing the generator script:

```bash
python3 -m venv /tmp/exhibition-docs-venv
/tmp/exhibition-docs-venv/bin/pip install python-docx fpdf2
/tmp/exhibition-docs-venv/bin/python docs/_generate_workflow_doc.py
```
