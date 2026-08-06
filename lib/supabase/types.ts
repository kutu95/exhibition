export type ProductType = "print" | "merchandise";
export type ProductVisibility = "public" | "vault";
export type LocationTag = string;
export type InstallationTag = "Cubarama" | "Captain Godfrey AI" | "Drift";
export type PhotoTypeTag = "Still camera" | "Drone" | "Underwater";
export type VaultAccessRequestStatus = "pending" | "approved" | "declined";
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
  photo_type_tag: PhotoTypeTag | null;
  is_available: boolean;
  is_featured: boolean;
  visibility: ProductVisibility;
  created_at: string;
};

export type VaultAccessRequest = {
  id: string;
  name: string;
  email: string;
  interest: string;
  organisation: string | null;
  status: VaultAccessRequestStatus;
  admin_note: string | null;
  invite_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type VaultInvite = {
  id: string;
  token_hash: string;
  label: string;
  email: string | null;
  access_request_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
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
  print_type: string | null;
  master_filename: string | null;
  source_print_profile_id: string | null;
  destination_print_profile_id: string | null;
  tier_label: string | null;
  finish: string | null;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  lab_cost_aud: number | null;
  suggested_retail_min_aud: number | null;
  suggested_retail_max_aud: number | null;
  turnaround_days_min: number | null;
  turnaround_days_max: number | null;
  shipping_class: string | null;
  fulfilment_notes: string | null;
  aspect_ratio: string | null;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
  front_face_width_mm: number | null;
  front_face_height_mm: number | null;
  fit_mode: "cover_crop" | "custom_size";
  crop_offset: number;
  size_lock: "long_edge" | "width" | "height" | null;
};

export type ProductImage = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export type Theme = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

export type ProductTheme = {
  product_id: string;
  theme_id: string;
  created_at: string;
  theme: Theme;
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

export type EmailCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type EmailCampaign = {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  blocks: unknown;
  status: EmailCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  audience_count: number | null;
  sent_count: number;
  failed_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailCampaignSendStatus = "pending" | "sent" | "failed" | "skipped";

export type EmailCampaignSend = {
  id: string;
  campaign_id: string;
  subscriber_id: string | null;
  email: string;
  resend_id: string | null;
  status: EmailCampaignSendStatus;
  error: string | null;
  sent_at: string | null;
  created_at: string;
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
  usage?: {
    site_content_keys: string[];
    product_image_count: number;
  };
};

export type PrintProfile = {
  id: string;
  display_name: string;
  profile_role: "source" | "destination";
  colour_space: string | null;
  paper_type: string | null;
  print_type: string | null;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  storage_path: string;
  checksum_sha256: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VariantTemplate = {
  id: string;
  variant_label: string;
  width_mm: number;
  height_mm: number;
  border_mm: number;
  paper_type: string;
  print_type: string;
  base_price_aud: number;
  sort_order: number;
  is_active: boolean;
  source_print_profile_id: string | null;
  destination_print_profile_id: string | null;
  tier_label: string | null;
  finish: string | null;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  lab_cost_aud: number | null;
  suggested_retail_min_aud: number | null;
  suggested_retail_max_aud: number | null;
  turnaround_days_min: number | null;
  turnaround_days_max: number | null;
  shipping_class: string | null;
  fulfilment_notes: string | null;
  aspect_ratio: string | null;
  canvas_wrap_mm: number | null;
  wrap_style: string | null;
  front_face_width_mm: number | null;
  front_face_height_mm: number | null;
  edition_size: number | null;
  created_at: string;
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
  product_themes: ProductTheme[];
};
