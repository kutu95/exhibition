"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import { formatAUD } from "../../lib/utils/currency";
import styles from "./FulfilmentDashboardClient.module.css";

type FulfilmentEvent = {
  id: string;
  event_type: string;
  notes: string | null;
  created_at: string;
};

export type FulfilmentDashboardItem = {
  order_item_id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  email: string;
  shipping_address: {
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  photo_title: string;
  title: string;
  slug: string;
  variant_label: string;
  master_filename: string | null;
  width_mm: number;
  height_mm: number;
  border_mm: number;
  paper_type: string | null;
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
  fit_mode?: string | null;
  crop_offset?: number | null;
  size_lock?: string | null;
  quantity: number;
  price: number;
  edition_number_assigned: number | null;
  edition_size: number | null;
  fulfilment_status: string;
  cloud_file_url: string | null;
  cloud_folder_path: string | null;
  pixel_perfect_order_ref: string | null;
  tracking_number: string | null;
  fulfilment_notes: string | null;
  fulfilment_events: FulfilmentEvent[];
};

type FulfilmentDashboardClientProps = {
  items: FulfilmentDashboardItem[];
  fetchedAt: string;
};

const inProcessStatuses = new Set(["awaiting_file", "file_ready", "submitted_to_lab", "shipped"]);

const statusOptions = [
  { value: "in_process", label: "In process" },
  { value: "all", label: "All active orders" },
  { value: "awaiting_file", label: "Awaiting file" },
  { value: "file_ready", label: "File ready" },
  { value: "submitted_to_lab", label: "Submitted to lab" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

const formatAddress = (item: FulfilmentDashboardItem): string =>
  [item.shipping_address.street, item.shipping_address.suburb, item.shipping_address.state, item.shipping_address.postcode]
    .filter(Boolean)
    .join(", ");

const driveFolderUrl = (item: FulfilmentDashboardItem): string | null => {
  const folder = item.cloud_folder_path?.trim();
  if (!folder || folder.includes("/") || folder.startsWith("file:")) return null;
  return `https://drive.google.com/drive/folders/${folder}`;
};

const localFilePath = (item: FulfilmentDashboardItem): string => {
  const url = item.cloud_file_url?.trim() ?? "";
  if (url.startsWith("file://")) {
    try {
      return decodeURIComponent(url.replace(/^file:\/\//, ""));
    } catch {
      return url.replace(/^file:\/\//, "");
    }
  }
  return url;
};

const driveFileUrl = (item: FulfilmentDashboardItem): string | null => {
  const url = item.cloud_file_url?.trim();
  return url?.startsWith("https://drive.google.com/") ? url : null;
};

const pixelPerfectText = (item: FulfilmentDashboardItem): string =>
  [
    `ORDER REF: ${item.order_number}`,
    `Customer: ${item.customer_name ?? ""}`,
    `Deliver to: ${formatAddress(item)}`,
    `${driveFileUrl(item) ? "Drive file" : "Local file"}: ${localFilePath(item)}`,
    driveFolderUrl(item) ? `Drive folder: ${driveFolderUrl(item)}` : null,
    item.tier_label ? `Range: ${item.tier_label}` : null,
    `Paper: ${item.paper_type ?? ""}`,
    item.finish ? `Finish: ${item.finish}` : null,
    `Size: ${item.width_mm} x ${item.height_mm} mm`,
    item.fit_mode === "custom_size"
      ? `Framing: custom size (lock ${item.size_lock ?? "long_edge"}) — order as custom paper at Pixel Perfect`
      : `Framing: cover crop${item.crop_offset ? ` (pan ${Number(item.crop_offset).toFixed(2)})` : ""}`,
    item.front_face_width_mm && item.front_face_height_mm
      ? `Front face: ${item.front_face_width_mm} x ${item.front_face_height_mm} mm`
      : null,
    item.canvas_wrap_mm ? `Canvas wrap: ${item.canvas_wrap_mm} mm${item.wrap_style ? `, ${item.wrap_style}` : ""}` : null,
    item.is_framed ? `Frame: ${item.frame_type ?? "Framed"}` : null,
    item.shipping_class ? `Shipping class: ${item.shipping_class}` : null,
    `Edition: ${item.edition_number_assigned ?? ""} of ${item.edition_size ?? ""}`,
    "Colour space: Adobe RGB 1998",
    `Print ready: Yes - ${item.print_dpi}ppi, Adobe RGB 1998, 8-bit TIFF, flattened, ZIP`,
    "Trimmed: Yes",
    item.variant_fulfilment_notes ? `Notes: ${item.variant_fulfilment_notes}` : null,
    `Qty: ${item.quantity}`,
  ].filter(Boolean).join("\n");

export function FulfilmentDashboardClient({ items, fetchedAt }: FulfilmentDashboardClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("in_process");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.order_item_id, item.pixel_perfect_order_ref ?? ""])),
  );
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.order_item_id, item.tracking_number ?? ""])),
  );

  const filteredItems = useMemo(
    () => {
      if (statusFilter === "all") return items;
      if (statusFilter === "in_process") {
        return items.filter((item) => inProcessStatuses.has(item.fulfilment_status));
      }
      return items.filter((item) => item.fulfilment_status === statusFilter);
    },
    [items, statusFilter],
  );

  const patchItem = async (itemId: string, body: Record<string, unknown>, successMessage: string) => {
    setError(null);
    setMessage(null);

    try {
      const response = await adminClientFetch(`/api/admin/fulfilment/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Fulfilment update failed.");
        return;
      }

      setMessage(successMessage);
      router.refresh();
    } catch (patchError) {
      setError(adminClientFetchError(patchError));
    }
  };

  const saveLabReference = async (item: FulfilmentDashboardItem) => {
    await patchItem(
      item.order_item_id,
      {
        fulfilment_status: "submitted_to_lab",
        pixel_perfect_order_ref: refs[item.order_item_id] || null,
      },
      `Saved Pixel Perfect reference for ${item.order_number}.`,
    );
  };

  const markShipped = async (item: FulfilmentDashboardItem) => {
    await patchItem(
      item.order_item_id,
      {
        fulfilment_status: "shipped",
        tracking_number: trackingNumbers[item.order_item_id] || null,
      },
      `Marked ${item.order_number} as shipped.`,
    );
  };

  const notifyCustomer = async (item: FulfilmentDashboardItem) => {
    setError(null);
    setMessage(null);

    try {
      const response = await adminClientFetch("/api/admin/fulfilment/notify-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_item_id: item.order_item_id,
          event_type: "shipped",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Customer notification failed.");
        return;
      }

      setMessage(`Notified ${item.customer_email}.`);
    } catch (notifyError) {
      setError(adminClientFetchError(notifyError));
    }
  };

  return (
    <div>
      <div className={styles.controls}>
        <label>
          Status{" "}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => router.refresh()}>
          Refresh
        </button>
        <span className={styles.muted}>Fetched {new Date(fetchedAt).toLocaleString("en-AU")}</span>
      </div>

      {message ? <p>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.grid}>
        {filteredItems.length === 0 ? <p className={styles.muted}>No orders match this filter.</p> : null}
        {filteredItems.map((item) => (
          <article className={styles.card} key={item.order_item_id}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{item.order_number}</h2>
                <p className={styles.muted}>{item.photo_title}</p>
              </div>
              <span className={styles.status}>{item.fulfilment_status.replaceAll("_", " ")}</span>
            </div>

            <div className={styles.details}>
              <p><strong>Customer:</strong> {item.customer_name ?? item.customer_email}</p>
              <p><strong>Email:</strong> {item.customer_email}</p>
              <p><strong>Address:</strong> {formatAddress(item)}</p>
              <p><strong>Variant:</strong> {item.variant_label}</p>
              <p><strong>Range:</strong> {item.tier_label ?? "—"}</p>
              <p><strong>Dimensions:</strong> {item.width_mm} x {item.height_mm} mm</p>
              <p>
                <strong>Framing:</strong>{" "}
                {item.fit_mode === "custom_size"
                  ? `Custom size (lock ${item.size_lock ?? "long_edge"})`
                  : `Cover crop${item.crop_offset ? ` · pan ${Number(item.crop_offset).toFixed(2)}` : ""}`}
              </p>
              <p><strong>Paper:</strong> {item.paper_type ?? "—"}</p>
              <p><strong>Finish:</strong> {item.finish ?? "—"}</p>
              <p><strong>Frame:</strong> {item.is_framed ? item.frame_type ?? "Framed" : "No"}</p>
              <p><strong>Shipping class:</strong> {item.shipping_class ?? "—"}</p>
              <p><strong>Colour space:</strong> Adobe RGB 1998</p>
              <p><strong>Edition:</strong> {item.edition_number_assigned ?? "—"} / {item.edition_size ?? "—"}</p>
              <p><strong>Qty:</strong> {item.quantity}</p>
              <p><strong>Price:</strong> {formatAUD(item.price)}</p>
              <p><strong>Master file:</strong> {item.master_filename ?? "—"}</p>
            </div>

            <div className={styles.actions}>
              {item.cloud_file_url ? (
                <>
                  <p>
                    <strong>{driveFileUrl(item) ? "Drive file:" : "Local file:"}</strong>{" "}
                    {driveFileUrl(item) ? (
                      <a href={driveFileUrl(item)!} target="_blank" rel="noreferrer">
                        Open TIFF in Google Drive
                      </a>
                    ) : (
                      <code>{localFilePath(item)}</code>
                    )}
                  </p>
                  {driveFolderUrl(item) ? (
                    <p>
                      <strong>Drive folder:</strong>{" "}
                      <a href={driveFolderUrl(item)!} target="_blank" rel="noreferrer">
                        Open in Google Drive
                      </a>
                      <span className={styles.muted}>
                        {driveFileUrl(item)
                          ? " — TIFF uploaded automatically"
                          : " — automatic upload was unavailable; upload the local TIFF manually"}
                      </span>
                    </p>
                  ) : null}
                  <textarea className={styles.textarea} readOnly value={pixelPerfectText(item)} />
                </>
              ) : (
                <p className={styles.muted}>Print file has not been prepared yet.</p>
              )}

              <div className={styles.actionRow}>
                <button
                  className={styles.button}
                  type="button"
                  disabled={!item.cloud_file_url}
                  onClick={() => navigator.clipboard.writeText(pixelPerfectText(item))}
                >
                  Copy Pixel Perfect Text
                </button>
                <a href="https://pixelperfect.com.au/order-form" target="_blank" rel="noreferrer">
                  Open Pixel Perfect Form
                </a>
              </div>

              <div className={styles.actionRow}>
                <input
                  className={styles.field}
                  value={refs[item.order_item_id] ?? ""}
                  onChange={(event) =>
                    setRefs((prev) => ({ ...prev, [item.order_item_id]: event.target.value }))
                  }
                  placeholder="Pixel Perfect order reference"
                />
                <button className={styles.button} type="button" onClick={() => saveLabReference(item)}>
                  Save Lab Reference
                </button>
              </div>

              <div className={styles.actionRow}>
                <input
                  className={styles.field}
                  value={trackingNumbers[item.order_item_id] ?? ""}
                  onChange={(event) =>
                    setTrackingNumbers((prev) => ({ ...prev, [item.order_item_id]: event.target.value }))
                  }
                  placeholder="Tracking number"
                />
                <button className={styles.button} type="button" onClick={() => markShipped(item)}>
                  Mark Shipped
                </button>
                <button
                  className={styles.button}
                  type="button"
                  disabled={!item.tracking_number && !trackingNumbers[item.order_item_id]}
                  onClick={() => notifyCustomer(item)}
                >
                  Notify Customer
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
