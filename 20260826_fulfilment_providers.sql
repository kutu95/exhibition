-- Dual lab fulfilment: PosterFactory + Pixel Perfect.
-- Additive only. Does not drop tables or rewrite existing order history.

ALTER TABLE exhibition.product_variants
  ADD COLUMN IF NOT EXISTS fulfilment_provider text
    CHECK (fulfilment_provider IS NULL OR fulfilment_provider IN ('posterfactory', 'pixelperfect')),
  ADD COLUMN IF NOT EXISTS fulfilment_class text
    CHECK (fulfilment_class IS NULL OR fulfilment_class IN ('standard', 'fine_art', 'framed', 'canvas')),
  ADD COLUMN IF NOT EXISTS supplier_product_code text;

ALTER TABLE exhibition.orders
  ADD COLUMN IF NOT EXISTS fulfilment_provider text
    CHECK (fulfilment_provider IS NULL OR fulfilment_provider IN ('posterfactory', 'pixelperfect'));

ALTER TABLE exhibition.order_items
  ADD COLUMN IF NOT EXISTS fulfilment_provider text
    CHECK (fulfilment_provider IS NULL OR fulfilment_provider IN ('posterfactory', 'pixelperfect')),
  ADD COLUMN IF NOT EXISTS frame_colour text;

UPDATE exhibition.product_variants pv
SET fulfilment_provider = 'pixelperfect'
FROM exhibition.products p
WHERE p.id = pv.product_id
  AND p.product_type = 'print'
  AND pv.fulfilment_provider IS NULL;

UPDATE exhibition.product_variants
SET fulfilment_class = CASE
  WHEN print_type = 'canvas'
    OR lower(coalesce(finish, '')) LIKE '%canvas%'
    OR lower(coalesce(variant_label, '')) LIKE '%canvas%'
    THEN 'canvas'
  WHEN is_framed
    OR (
      lower(coalesce(variant_label, '')) LIKE '%framed%'
      AND lower(coalesce(variant_label, '')) NOT LIKE '%unframed%'
    )
    THEN 'framed'
  WHEN print_type = 'photo' THEN 'standard'
  ELSE 'fine_art'
END
WHERE fulfilment_class IS NULL
   OR (
     fulfilment_class = 'framed'
     AND is_framed = false
     AND lower(coalesce(variant_label, '')) LIKE '%unframed%'
   );

UPDATE exhibition.order_items oi
SET fulfilment_provider = pv.fulfilment_provider
FROM exhibition.product_variants pv
WHERE pv.id = oi.variant_id
  AND oi.fulfilment_provider IS NULL
  AND pv.fulfilment_provider IS NOT NULL;

UPDATE exhibition.orders o
SET fulfilment_provider = sub.provider
FROM (
  SELECT oi.order_id, min(oi.fulfilment_provider) AS provider
  FROM exhibition.order_items oi
  WHERE oi.fulfilment_provider IS NOT NULL
  GROUP BY oi.order_id
  HAVING count(DISTINCT oi.fulfilment_provider) = 1
) sub
WHERE o.id = sub.order_id
  AND o.fulfilment_provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_variants_fulfilment_provider
  ON exhibition.product_variants (fulfilment_provider);

CREATE INDEX IF NOT EXISTS idx_order_items_fulfilment_provider
  ON exhibition.order_items (fulfilment_provider);
