import { z } from "zod";

export const campaignImageSizes = ["full", "medium", "small"] as const;
export type CampaignImageSize = (typeof campaignImageSizes)[number];

export const campaignImageDisplayWidth: Record<CampaignImageSize, number> = {
  full: 600,
  medium: 360,
  small: 220,
};

export const campaignBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("heading"),
    text: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("paragraph"),
    text: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("image"),
    url: z.string().min(1),
    alt: z.string().optional().default(""),
    size: z.enum(campaignImageSizes).optional(),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("product"),
    product_id: z.string().uuid(),
    slug: z.string().min(1),
    title: z.string().min(1),
    image_url: z.string().min(1),
    cta_label: z.string().optional().default("View print"),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("button"),
    label: z.string().min(1),
    url: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("merge"),
    slot: z.enum(["order_summary", "shipment_details"]),
  }),
]);

export type CampaignBlock = z.infer<typeof campaignBlockSchema>;

export const campaignBlocksSchema = z.array(campaignBlockSchema);

export const createCampaignBlockId = (): string =>
  `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const emptyCampaignBlocks = (): CampaignBlock[] => [
  {
    id: createCampaignBlockId(),
    type: "heading",
    text: "Hello from The Georgette 150th",
  },
  {
    id: createCampaignBlockId(),
    type: "paragraph",
    text: "Share a short update about new prints, the exhibition, or a story behind a photograph.",
  },
];
