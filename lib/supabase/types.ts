export type ProductType = "print" | "merchandise";
export type LocationTag =
  | "Calgardup Bay"
  | "Red Gate Beach"
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

export type ProductWithVariantsAndImages = Product & {
  product_variants: ProductVariant[];
  product_images: ProductImage[];
};
