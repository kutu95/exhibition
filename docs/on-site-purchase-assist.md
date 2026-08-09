# On-site purchase assist

Dual path for wall prints during Open Studios:

1. **Visitor phone** — wall QR opens `/shop/{slug}?src=wall` (optional `&variant=`). When purchases are allowed, **Buy this print** starts Stripe Checkout with Exhibition pickup / ship options.
2. **Staff desk** — `/admin/on-site` records cash or charges via Square Point of Sale + reader, then creates a paid exhibition order (fulfilment unchanged).

Online/remote payments remain Stripe. Card-present on site uses Square.

## Wall QR

- Admin → product edit → **Wall QR code**
- Always includes `src=wall`
- Optionally select the hung size so the visitor lands on that variant
- Reprint labels after deploying this change
- **Open in on-site sale** deep-links staff into the desk console for that product

## Smoke test (before lifting `PURCHASES_LAN_ONLY`)

Do **not** flip `PURCHASES_LAN_ONLY` in production until these pass.

### A. Wall UX (public host, gate still on)

1. Open a wall URL: `https://exhibition.margies.app/shop/{slug}?src=wall`
2. Confirm green wall banner tells visitors to ask at the desk (no Buy button)
3. Favourite still works
4. Plausible (or network) shows `View Product` with `source=wall`

### B. Visitor self-serve Stripe (LAN or temporary gate off)

1. On LAN (`Host: localhost` via tunnel) **or** briefly set `PURCHASES_LAN_ONLY=false` on a non-production instance
2. Open `?src=wall` → **Buy this print**
3. Stripe Checkout offers **Exhibition pickup** and ship
4. Complete payment → order appears in admin → fulfilment `awaiting_file`
5. Order notes include `source=wall` when bought from wall mode
6. Confirm leftover cart items were **not** included (Buy this print is single-line)

### C. Staff Square / cash

1. Apply migration `20260809_orders_square_payment_id.sql` on the exhibition schema
2. Set `SQUARE_APPLICATION_ID` and allowlist `{NEXT_PUBLIC_SITE_URL}/admin/on-site/square-return` in Square Developer Console
3. Install Square Point of Sale on the staff phone/tablet; pair the reader; sign in
4. `/admin/on-site` → select print → customer → **Charge with Square reader**
5. Complete card on reader → return creates paid order with `square_payment_id`
6. Fallback: charge in Square app manually → paste receipt id → **Mark paid after Square**
7. **Record cash payment** creates paid order without Square
8. Confirm fulfilment row / edition assignment

### D. Open public sales

When A–C are good:

1. Set `PURCHASES_LAN_ONLY=false` (or unset) in PM2 / env
2. Restart the app
3. Scan a **new** wall QR on a phone (not LAN) and complete a small real or refundable test purchase
4. Keep staff Square path as backup for weak signal / cash / swipe-and-go

## Env

| Variable | Purpose |
|----------|---------|
| `PURCHASES_LAN_ONLY` | When true, public host cannot checkout (desk/Square still works via admin) |
| `SQUARE_APPLICATION_ID` | Square POS API application id |
| `NEXT_PUBLIC_SITE_URL` | Used for wall QR origin and Square callback URL |
