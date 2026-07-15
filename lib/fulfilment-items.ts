import { queryPostgres } from "./postgres";

export type FulfilmentEvent = {
  id: string;
  event_type: string;
  notes: string | null;
  created_at: string;
};

export type FulfilmentItem = {
  order_item_id: string;
  variant_id: string;
  order_number: string;
  order_id: string;
  customer_name: string | null;
  customer_email: string;
  email: string;
  shipping_address: {
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  photo_title: string;
  title: string;
  slug: string;
  variant_label: string;
  master_filename: string | null;
  width_mm: number;
  height_mm: number;
  border_mm: number;
  paper_type: string | null;
  print_type: string | null;
  tier_label: string | null;
  finish: string | null;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  shipping_class: string | null;
  variant_fulfilment_notes: string | null;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
  front_face_width_mm: number | null;
  front_face_height_mm: number | null;
  source_print_profile_id: string | null;
  source_print_profile_display_name: string | null;
  source_print_profile_storage_path: string | null;
  destination_print_profile_id: string | null;
  destination_print_profile_display_name: string | null;
  destination_print_profile_storage_path: string | null;
  quantity: number;
  unit_price_aud: number;
  price: number;
  edition_number_assigned: number | null;
  edition_size: number | null;
  date_ordered: string;
  created_at: string;
  fulfilment_status: string;
  cloud_file_url: string | null;
  cloud_folder_path: string | null;
  pixel_perfect_order_ref: string | null;
  tracking_number: string | null;
  fulfilment_notes: string | null;
  file_ready_at: string | null;
  submitted_to_lab_at: string | null;
  shipped_at: string | null;
  events: FulfilmentEvent[];
  fulfilment_events: FulfilmentEvent[];
};

type FulfilmentItemRow = {
  item: FulfilmentItem;
};

const fulfilmentEventsJson = `
  coalesce(
    (
      select json_agg(
        json_build_object(
          'id', fe.id,
          'event_type', fe.event_type,
          'notes', fe.notes,
          'created_at', fe.created_at
        )
        order by fe.created_at asc
      )
      from exhibition.fulfilment_events fe
      where fe.order_item_id = oi.id
    ),
    '[]'::json
  )
`;

const fulfilmentItemJson = `
  (
    jsonb_build_object(
      'order_item_id', oi.id,
      'variant_id', pv.id,
      'order_number', o.order_number,
      'order_id', o.id,
      'customer_name', o.customer_name,
      'customer_email', o.customer_email,
      'email', o.customer_email,
      'shipping_address', json_build_object(
        'street', coalesce(o.shipping_address #>> '{address,line1}', o.shipping_address->>'street', o.shipping_address->>'line1', ''),
        'suburb', coalesce(o.shipping_address #>> '{address,city}', o.shipping_address->>'suburb', o.shipping_address->>'city', ''),
        'state', coalesce(o.shipping_address #>> '{address,state}', o.shipping_address->>'state', ''),
        'postcode', coalesce(o.shipping_address #>> '{address,postal_code}', o.shipping_address->>'postcode', o.shipping_address->>'postal_code', '')
      ),
      'street', coalesce(o.shipping_address #>> '{address,line1}', o.shipping_address->>'street', o.shipping_address->>'line1', ''),
      'suburb', coalesce(o.shipping_address #>> '{address,city}', o.shipping_address->>'suburb', o.shipping_address->>'city', ''),
      'state', coalesce(o.shipping_address #>> '{address,state}', o.shipping_address->>'state', ''),
      'postcode', coalesce(o.shipping_address #>> '{address,postal_code}', o.shipping_address->>'postcode', o.shipping_address->>'postal_code', ''),
      'photo_title', p.title,
      'title', p.title,
      'slug', p.slug,
      'variant_label', pv.variant_label,
      'master_filename', pv.master_filename,
      'width_mm', coalesce(pv.width_mm, 0),
      'height_mm', coalesce(pv.height_mm, 0),
      'border_mm', coalesce(pv.border_mm, 0),
      'paper_type', pv.paper_type
    )
    || jsonb_build_object(
      'print_type', pv.print_type,
      'tier_label', pv.tier_label,
      'finish', pv.finish,
      'is_framed', pv.is_framed,
      'frame_type', pv.frame_type,
      'print_dpi', pv.print_dpi,
      'shipping_class', pv.shipping_class,
      'variant_fulfilment_notes', pv.fulfilment_notes,
      'canvas_wrap_mm', pv.canvas_wrap_mm,
      'wrap_style', pv.wrap_style,
      'front_face_width_mm', pv.front_face_width_mm,
      'front_face_height_mm', pv.front_face_height_mm,
      'source_print_profile_id', pv.source_print_profile_id,
      'source_print_profile_display_name', spp.display_name,
      'source_print_profile_storage_path', spp.storage_path,
      'destination_print_profile_id', pv.destination_print_profile_id,
      'destination_print_profile_display_name', dpp.display_name,
      'destination_print_profile_storage_path', dpp.storage_path,
      'quantity', oi.quantity,
      'unit_price_aud', oi.unit_price_aud,
      'price', oi.unit_price_aud
    )
    || jsonb_build_object(
      'edition_number_assigned', oi.edition_number_assigned,
      'edition_size', pv.edition_size,
      'date_ordered', o.created_at,
      'created_at', o.created_at,
      'fulfilment_status', oi.fulfilment_status,
      'cloud_file_url', oi.cloud_file_url,
      'cloud_folder_path', oi.cloud_folder_path,
      'pixel_perfect_order_ref', oi.pixel_perfect_order_ref,
      'tracking_number', oi.tracking_number,
      'fulfilment_notes', oi.fulfilment_notes,
      'file_ready_at', oi.file_ready_at,
      'submitted_to_lab_at', oi.submitted_to_lab_at,
      'shipped_at', oi.shipped_at,
      'events', (${fulfilmentEventsJson}),
      'fulfilment_events', (${fulfilmentEventsJson})
    )
  )::json as item
`;

export const getFulfilmentItem = async (orderItemId: string): Promise<FulfilmentItem | null> => {
  const { rows } = await queryPostgres<FulfilmentItemRow>(
    `
      select ${fulfilmentItemJson}
      from exhibition.order_items oi
      join exhibition.orders o on o.id = oi.order_id
      join exhibition.product_variants pv on pv.id = oi.variant_id
      join exhibition.products p on p.id = pv.product_id
      left join exhibition.print_profiles spp on spp.id = pv.source_print_profile_id and spp.is_active = true
      left join exhibition.print_profiles dpp on dpp.id = pv.destination_print_profile_id and dpp.is_active = true
      where oi.id = $1
      limit 1
    `,
    [orderItemId],
  );

  return rows[0]?.item ?? null;
};

export const getFulfilmentQueue = async (): Promise<FulfilmentItem[]> => {
  const { rows } = await queryPostgres<FulfilmentItemRow>(`
    select ${fulfilmentItemJson}
    from exhibition.order_items oi
    join exhibition.orders o on o.id = oi.order_id
    join exhibition.product_variants pv on pv.id = oi.variant_id
    join exhibition.products p on p.id = pv.product_id
    left join exhibition.print_profiles spp on spp.id = pv.source_print_profile_id and spp.is_active = true
    left join exhibition.print_profiles dpp on dpp.id = pv.destination_print_profile_id and dpp.is_active = true
    where p.product_type = 'print'
      and oi.fulfilment_status in ('awaiting_file', 'file_ready', 'submitted_to_lab', 'shipped', 'delivered')
    order by o.created_at asc, oi.id asc
  `);

  return rows.map((row) => row.item);
};
