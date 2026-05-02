import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authedRequest = (url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: {
      authorization: "Bearer test-key",
      ...(init.headers ?? {}),
    },
  });

describe("Photolab API contract", () => {
  beforeEach(() => {
    process.env.FULFILMENT_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.FULFILMENT_API_KEY;
  });

  it("rejects fulfilment queue requests without bearer auth", async () => {
    const { GET } = await import("../app/api/fulfilment/queue/route");

    const response = await GET(new Request("http://localhost/api/fulfilment/queue"));

    expect(response.status).toBe(401);
  });

  it("returns Photolab-compatible fulfilment queue shape", async () => {
    vi.doMock("../lib/fulfilment-items", () => ({
      getFulfilmentQueue: vi.fn(async () => [
        {
          order_item_id: "item-1",
          order_number: "GEO-0001",
          customer_email: "buyer@example.com",
          email: "buyer@example.com",
          shipping_address: {
            street: "1 Test St",
            suburb: "Margaret River",
            state: "WA",
            postcode: "6285",
          },
          street: "1 Test St",
          suburb: "Margaret River",
          state: "WA",
          postcode: "6285",
          photo_title: "Isaac Rock No. 3",
          title: "Isaac Rock No. 3",
          slug: "isaac-rock-no-3",
          variant_label: "A2 / Hahnemühle Photo Rag",
          master_filename: "isaac_rock_no_3.tif",
          width_mm: 420,
          height_mm: 594,
          border_mm: 0,
          paper_type: "Hahnemühle Photo Rag 308gsm",
          edition_number_assigned: 1,
          edition_size: 10,
          quantity: 1,
          price: 45000,
          date_ordered: "2026-04-27T00:00:00.000Z",
          fulfilment_status: "awaiting_file",
          cloud_file_url: null,
          cloud_folder_path: null,
          pixel_perfect_order_ref: null,
          tracking_number: null,
          events: [],
          fulfilment_events: [],
        },
      ]),
    }));

    const { GET } = await import("../app/api/fulfilment/queue/route");
    const response = await GET(authedRequest("http://localhost/api/fulfilment/queue"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      order_item_id: "item-1",
      email: "buyer@example.com",
      slug: "isaac-rock-no-3",
      master_filename: "isaac_rock_no_3.tif",
      width_mm: 420,
      height_mm: 594,
      price: 45000,
      fulfilment_events: [],
    });
  });

  it("persists fulfilment status updates and writes an event", async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];

    vi.doMock("../lib/postgres", () => ({
      withTransaction: vi.fn(async (callback) =>
        callback({
          query: vi.fn(async (sql: string, params?: unknown[]) => {
            queries.push({ sql, params });
            if (sql.includes("returning fulfilment_status")) {
              return { rows: [{ fulfilment_status: "file_ready" }] };
            }
            return { rows: [] };
          }),
        }),
      ),
    }));

    vi.doMock("../lib/fulfilment-items", () => ({
      getFulfilmentItem: vi.fn(async () => ({
        order_item_id: "00000000-0000-0000-0000-000000000001",
        fulfilment_status: "file_ready",
        events: [{ event_type: "file_ready" }],
      })),
    }));

    const { PATCH } = await import("../app/api/fulfilment/items/[order_item_id]/route");
    const response = await PATCH(
      authedRequest("http://localhost/api/fulfilment/items/00000000-0000-0000-0000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({
          fulfilment_status: "file_ready",
          cloud_file_url: "https://drive.example/file",
        }),
      }),
      { params: Promise.resolve({ order_item_id: "00000000-0000-0000-0000-000000000001" }) },
    );

    expect(response.status).toBe(200);
    expect(queries.some((query) => query.sql.includes("update exhibition.order_items"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("insert into exhibition.fulfilment_events"))).toBe(true);
  });

  it("stores master_filename when registering a product", async () => {
    const productId = "00000000-0000-0000-0000-000000000010";
    const variantId = "00000000-0000-0000-0000-000000000011";
    let variantInsertParams: unknown[] | undefined;

    vi.doMock("../lib/postgres", () => ({
      withTransaction: vi.fn(async (callback) =>
        callback({
          query: vi.fn(async (sql: string, params?: unknown[]) => {
            if (sql.includes("insert into exhibition.products")) {
              return {
                rows: [
                  {
                    id: productId,
                    title: "New Print",
                    slug: "new-print",
                    description: "A print",
                    product_type: "print",
                    location_tag: "Isaac Rock",
                    installation_tag: null,
                    is_available: true,
                    is_featured: false,
                    created_at: "2026-04-27T00:00:00.000Z",
                  },
                ],
              };
            }

            if (sql.includes("insert into exhibition.product_variants")) {
              variantInsertParams = params;
              return {
                rows: [
                  {
                    id: variantId,
                    product_id: productId,
                    variant_label: "A2",
                    price_aud: 45000,
                    edition_size: 10,
                    stripe_price_id: null,
                    is_active: true,
                    master_filename: params?.[2],
                  },
                ],
              };
            }

            return { rows: [{ id: "image-id", product_id: productId, image_url: "https://example.com/image.jpg" }] };
          }),
        }),
      ),
    }));

    vi.doMock("../lib/stripe", () => ({
      stripe: {
        products: { create: vi.fn(async () => ({ id: "prod_test" })) },
        prices: { create: vi.fn(async () => ({ id: "price_test" })) },
      },
    }));

    vi.doMock("../lib/supabase/admin", () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      },
    }));

    const { POST } = await import("../app/api/products/register/route");
    const response = await POST(
      authedRequest("http://localhost/api/products/register", {
        method: "POST",
        body: JSON.stringify({
          title: "New Print",
          slug: "new-print",
          description: "A print",
          location_tag: "Isaac Rock",
          installation_tag: null,
          is_featured: false,
          edition_size: 10,
          master_filename: "new_print.tif",
          web_image_url: "https://example.com/image.jpg",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(variantInsertParams?.[2]).toBe("new_print.tif");
    expect(body).toMatchObject({
      ok: true,
      product_id: productId,
      variants_created: 1,
    });
  });

  it("rejects media uploads without bearer auth", async () => {
    const { POST } = await import("../app/api/media/upload/route");

    const response = await POST(new Request("http://localhost/api/media/upload", { method: "POST" }));

    expect(response.status).toBe(401);
  });
});
