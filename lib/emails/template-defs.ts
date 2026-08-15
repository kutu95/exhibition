import { createCampaignBlockId, type CampaignBlock } from "../campaigns/blocks";

export const EMAIL_TEMPLATE_SLUGS = ["order_confirmation", "order_shipped", "new_subscriber"] as const;

export type EmailTemplateSlug = (typeof EMAIL_TEMPLATE_SLUGS)[number];

export const isEmailTemplateSlug = (value: string): value is EmailTemplateSlug =>
  (EMAIL_TEMPLATE_SLUGS as readonly string[]).includes(value);

export type EmailTemplateKind = "transactional" | "marketing";

export type EmailTemplateDefinition = {
  slug: EmailTemplateSlug;
  name: string;
  kind: EmailTemplateKind;
  description: string;
  tokens: Array<{ token: string; meaning: string }>;
  defaultSubject: string;
  defaultPreview: string;
  defaultBlocks: () => CampaignBlock[];
};

const p = (text: string): CampaignBlock => ({
  id: createCampaignBlockId(),
  type: "paragraph",
  text,
});

const h = (text: string): CampaignBlock => ({
  id: createCampaignBlockId(),
  type: "heading",
  text,
});

const merge = (slot: "order_summary" | "shipment_details"): CampaignBlock => ({
  id: createCampaignBlockId(),
  type: "merge",
  slot,
});

export const EMAIL_TEMPLATE_DEFINITIONS: Record<EmailTemplateSlug, EmailTemplateDefinition> = {
  order_confirmation: {
    slug: "order_confirmation",
    name: "Order confirmation",
    kind: "transactional",
    description: "Sent automatically after a successful Stripe (or paid manual) checkout.",
    tokens: [
      { token: "{{first_name}}", meaning: "Customer first name" },
      { token: "{{customer_name}}", meaning: "Full name from checkout" },
      { token: "{{order_number}}", meaning: "GEO-0001" },
      { token: "{{total}}", meaning: "Order total, formatted" },
      { token: "{{contact_email}}", meaning: "Reply-to contact address" },
    ],
    defaultSubject: "Your order from The Georgette 150th — [{{order_number}}]",
    defaultPreview: "Thank you for your order. Print details and next steps inside.",
    defaultBlocks: () => [
      h("Thank you for your order"),
      p("Thank you for your order from The Georgette 150th."),
      p("Order {{order_number}}"),
      merge("order_summary"),
      p(
        "All prints are made to order on archival paper and signed and numbered by John Bowskill. Please allow 3-4 business days for production and despatch. You will receive a second email when your order has been shipped.",
      ),
      p(
        "If you have any questions, reply to this email or contact us at {{contact_email}} with your order number.",
      ),
      p(
        "The Georgette 150th is showing at Margaret River Region Open Studios from 12 to 27 September 2026. If you are visiting in person, prints purchased online can be collected at the exhibition — contact us to arrange this.",
      ),
    ],
  },
  order_shipped: {
    slug: "order_shipped",
    name: "Print shipped",
    kind: "transactional",
    description: "Sent when you click Notify Customer on a fulfilment card (after tracking is saved).",
    tokens: [
      { token: "{{first_name}}", meaning: "Customer first name" },
      { token: "{{customer_name}}", meaning: "Full name" },
      { token: "{{order_number}}", meaning: "GEO-0001" },
      { token: "{{photo_title}}", meaning: "Print title" },
      { token: "{{variant_label}}", meaning: "Size / paper" },
      { token: "{{edition_line}}", meaning: "Edition 2 of 25" },
      { token: "{{tracking_number}}", meaning: "Courier tracking" },
      { token: "{{contact_email}}", meaning: "Reply-to contact address" },
    ],
    defaultSubject: "Your print has shipped — [{{order_number}}]",
    defaultPreview: "Your print from The Georgette 150th is on its way.",
    defaultBlocks: () => [
      h("Your print has shipped"),
      p("Hi {{first_name}},"),
      p("Your print from The Georgette 150th has shipped."),
      merge("shipment_details"),
      p("Your print is shipping from Sydney. Please allow 3-7 business days for delivery within WA."),
      p(
        "If you have any questions, reply to this email or contact us at {{contact_email}} with your order number.",
      ),
    ],
  },
  new_subscriber: {
    slug: "new_subscriber",
    name: "New subscriber",
    kind: "marketing",
    description:
      "Sent automatically when someone joins the mailing list. Includes an unsubscribe link. Replaces the old campaign named “New Subscriber” when this template has content.",
    tokens: [{ token: "{{first_name}}", meaning: "Subscriber first name, if collected" }],
    defaultSubject: "Welcome to The Georgette 150th",
    defaultPreview: "Thanks for joining the mailing list.",
    defaultBlocks: () => [
      h("Welcome"),
      p("Thank you for subscribing to The Georgette 150th. I will write when there are new prints, exhibition dates, or stories behind the photographs."),
      p("John Bowskill"),
    ],
  },
};
