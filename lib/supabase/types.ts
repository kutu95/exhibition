export type ProductType = "print" | "merchandise";
export type LocationTag =
  | "Calgardup Bay"
  | "Redgate Beach"
  | "Isaac Rock"
  | "SS Georgette Wreck";
export type InstallationTag = "Cubarama" | "Captain Godfrey AI" | "Drift";
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  product_type: ProductType;
  location_tag: LocationTag | null;
  installation_tag: InstallationTag | null;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  variant_label: string;
  price_aud: number;
  edition_size: number | null;
  edition_number: number | null;
  stripe_price_id: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  created_at: string;
  width_mm: number | null;
  height_mm: number | null;
  border_mm: number;
  paper_type: string | null;
  print_type: "fine_art" | "photo" | "canvas" | "metal" | null;
  master_filename: string | null;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type Order = {
  id: string;
  order_number: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  status: OrderStatus;
  customer_email: string;
  customer_name: string | null;
  shipping_address: Record<string, unknown> | null;
  subtotal_aud: number;
  shipping_aud: number;
  total_aud: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  fulfilment_status: "awaiting_file" | "file_ready" | "submitted_to_lab" | "shipped" | "delivered";
  cloud_file_url: string | null;
  cloud_folder_path: string | null;
  pixel_perfect_order_ref: string | null;
  tracking_number: string | null;
  fulfilment_notes: string | null;
  file_ready_at: string | null;
  submitted_to_lab_at: string | null;
  shipped_at: string | null;
};

export type EmailSubscriber = {
  id: string;
  email: string;
  first_name: string | null;
  source: string | null;
  is_confirmed: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export type ExhibitionEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string;
  duration_minutes: number | null;
  location_name: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  is_ticketed: boolean;
  ticket_url: string | null;
  is_published: boolean;
  created_at: string;
};

export type MediaFile = {
  id: string;
  filename: string;
  original_filename: string;
  file_type: "image" | "video";
  mime_type: string;
  file_size_bytes: number;
  url_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
  usage_note: string | null;
  uploaded_at: string;
};

export type SiteContent = {
  id: string;
  content_key: string;
  content_value: string | null;
  content_type: "text" | "html" | "image" | "video";
  media_file_id: string | null;
  updated_at: string;
};

export type ProductWithVariantsAndImages = Product & {
  product_variants: ProductVariant[];
  product_images: ProductImage[];
};
