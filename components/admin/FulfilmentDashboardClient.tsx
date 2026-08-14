"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import { buildPixelPerfectOrderEmail } from "../../lib/pixel-perfect-email";
import { formatLabDimensions } from "../../lib/print-size";
import { isStudioOrderNotes } from "../../lib/studio-orders";
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
  date_ordered?: string | null;
  created_at?: string | null;
  fulfilment_status: string;
  cloud_file_url: string | null;
  cloud_folder_path: string | null;
  /** Absolute path under LOCAL_OUTPUT_DIR when the worker has prepared a lab TIFF. */
  local_print_file_path?: string | null;
  local_print_file_name?: string | null;
  pixel_perfect_order_ref: string | null;
  tracking_number: string | null;
  fulfilment_notes: string | null;
  order_notes?: string | null;
  file_ready_at?: string | null;
  submitted_to_lab_at?: string | null;
  shipped_at?: string | null;
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

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  if (item.local_print_file_path?.trim()) return item.local_print_file_path.trim();
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

const hasPreparedPrintFile = (item: FulfilmentDashboardItem): boolean =>
  Boolean(item.local_print_file_path?.trim()) || Boolean(item.cloud_file_url?.trim().startsWith("file:"));

const expectedPrintFileName = (item: FulfilmentDashboardItem): string => {
  const width = Math.trunc(Number(item.width_mm) || 0);
  const height = Math.trunc(Number(item.height_mm) || 0);
  return `${item.order_number}_${item.slug}_${width}x${height}mm.tif`;
};

const localPrintFileName = (item: FulfilmentDashboardItem): string => {
  if (item.local_print_file_name?.trim()) return item.local_print_file_name.trim();
  const filePath = localFilePath(item);
  if (filePath && !/^https?:/i.test(filePath) && !filePath.startsWith("file:")) {
    const parts = filePath.split(/[/\\]/);
    const name = parts[parts.length - 1];
    if (name && /\.tiff?$/i.test(name)) return name;
  }
  return expectedPrintFileName(item);
};

const printFilePreviewUrl = (orderItemId: string): string =>
  `/api/admin/fulfilment/items/${orderItemId}/print-file?mode=preview`;

const printFileDownloadUrl = (orderItemId: string): string =>
  `/api/admin/fulfilment/items/${orderItemId}/print-file?mode=download`;

const orderDate = (item: FulfilmentDashboardItem): string | null =>
  item.date_ordered ?? item.created_at ?? null;

const statusTimeline = (item: FulfilmentDashboardItem) => {
  const steps = [
    { key: "ordered", label: "Ordered", at: orderDate(item) },
    { key: "file_ready", label: "File ready", at: item.file_ready_at ?? null },
    { key: "submitted_to_lab", label: "Submitted to lab", at: item.submitted_to_lab_at ?? null },
    { key: "shipped", label: "Shipped", at: item.shipped_at ?? null },
  ];

  const eventLines = (item.fulfilment_events ?? []).map((event) => ({
    key: event.id,
    label: event.event_type.replaceAll("_", " "),
    at: event.created_at,
    notes: event.notes,
  }));

  return { steps, eventLines };
};

const isStudioItem = (item: FulfilmentDashboardItem): boolean =>
  isStudioOrderNotes(item.order_notes) || isStudioOrderNotes(item.fulfilment_notes);

const pixelPerfectEmail = (item: FulfilmentDashboardItem) =>
  buildPixelPerfectOrderEmail({
    order_number: item.order_number,
    photo_title: item.photo_title || item.title,
    width_mm: item.width_mm,
    height_mm: item.height_mm,
    paper_type: item.paper_type,
    finish: item.finish,
    is_framed: item.is_framed,
    frame_type: item.frame_type,
    print_dpi: item.print_dpi,
    quantity: item.quantity,
    is_studio_order: isStudioItem(item),
    drive_folder_url: driveFolderUrl(item),
    filename: localPrintFileName(item),
    canvas_wrap_mm: item.canvas_wrap_mm,
    wrap_style: item.wrap_style,
    shipping_address: item.shipping_address,
  });

export function FulfilmentDashboardClient({ items, fetchedAt }: FulfilmentDashboardClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("in_process");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FulfilmentDashboardItem | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [refs, setRefs] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.order_item_id, item.pixel_perfect_order_ref ?? ""])),
  );
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.order_item_id, item.tracking_number ?? ""])),
  );

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewItem]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [previewItem?.order_item_id]);

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setError(null);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(null);
      setError(`Could not copy ${label.toLowerCase()}.`);
    }
  };

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
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => setExpandedIds(new Set(filteredItems.map((item) => item.order_item_id)))}
        >
          Expand all
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => setExpandedIds(new Set())}
        >
          Collapse all
        </button>
        <span className={styles.muted}>Fetched {new Date(fetchedAt).toLocaleString("en-AU")}</span>
      </div>

      {message ? <p>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.grid}>
        {filteredItems.length === 0 ? <p className={styles.muted}>No orders match this filter.</p> : null}
        {filteredItems.map((item) => {
          const isExpanded = expandedIds.has(item.order_item_id);
          const timeline = statusTimeline(item);
          const orderedAt = orderDate(item);

          return (
            <details
              className={styles.card}
              key={item.order_item_id}
              open={isExpanded}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setExpandedIds((current) => {
                  const next = new Set(current);
                  if (nextOpen) next.add(item.order_item_id);
                  else next.delete(item.order_item_id);
                  return next;
                });
              }}
            >
              <summary className={styles.cardSummary}>
                <div className={styles.summaryMain}>
                  <span className={styles.chevron} aria-hidden="true">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  <div>
                    <h2>
                      {item.order_number}
                      <span className={styles.summaryTitle}> {item.photo_title}</span>
                    </h2>
                    <p className={styles.summaryMeta}>
                      <span className={styles.summaryCustomer}>
                        {item.customer_name?.trim() || item.customer_email || "Unknown customer"}
                      </span>
                      <span>·</span>
                      <span>{item.variant_label}</span>
                      <span>·</span>
                      <span>Ordered {formatDateTime(orderedAt)}</span>
                    </p>
                  </div>
                </div>
                <div className={styles.summaryBadges}>
                  {isStudioItem(item) ? <span className={styles.studioBadge}>Studio</span> : null}
                  <span className={styles.status}>{item.fulfilment_status.replaceAll("_", " ")}</span>
                </div>
              </summary>

              <div className={styles.cardBody}>
                <div className={styles.timeline}>
                  <h3>Status dates</h3>
                  <ul>
                    {timeline.steps.map((step) => (
                      <li key={step.key}>
                        <strong>{step.label}:</strong> {formatDateTime(step.at)}
                      </li>
                    ))}
                  </ul>
                  {timeline.eventLines.length > 0 ? (
                    <>
                      <h3>Event log</h3>
                      <ul>
                        {timeline.eventLines.map((event) => (
                          <li key={event.key}>
                            <strong>{event.label}:</strong> {formatDateTime(event.at)}
                            {event.notes ? ` — ${event.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>

                <div className={styles.details}>
                  <p><strong>Customer:</strong> {item.customer_name ?? item.customer_email}</p>
                  <p><strong>Email:</strong> {item.customer_email}</p>
                  <p><strong>Address:</strong> {formatAddress(item)}</p>
                  <p><strong>Variant:</strong> {item.variant_label}</p>
                  <p><strong>Range:</strong> {item.tier_label ?? "—"}</p>
                  <p><strong>Dimensions:</strong> {formatLabDimensions(item.width_mm, item.height_mm)}</p>
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
                  <p>
                    <strong>Edition:</strong>{" "}
                    {isStudioItem(item)
                      ? "n/a (artist copy)"
                      : `${item.edition_number_assigned ?? "—"} / ${item.edition_size ?? "—"}`}
                  </p>
                  <p><strong>Qty:</strong> {item.quantity}</p>
                  <p>
                    <strong>Price:</strong>{" "}
                    {isStudioItem(item) ? "Studio copy — pay lab directly" : formatAUD(item.price)}
                  </p>
                  <p><strong>Master file:</strong> {item.master_filename ?? "—"}</p>
                </div>

                <div className={styles.actions}>
                  {hasPreparedPrintFile(item) || driveFileUrl(item) || item.cloud_file_url ? (
                    <>
                      {hasPreparedPrintFile(item) ? (
                        <div className={styles.printFileBlock}>
                          <p>
                            <strong>Prepared print file:</strong>{" "}
                            <span className={styles.localFileRow}>
                              <button
                                className={styles.fileLink}
                                type="button"
                                onClick={() => setPreviewItem(item)}
                              >
                                {localPrintFileName(item)}
                              </button>
                              <button
                                className={styles.buttonSecondary}
                                type="button"
                                onClick={() => setPreviewItem(item)}
                              >
                                View
                              </button>
                              <a
                                className={styles.buttonSecondary}
                                href={printFileDownloadUrl(item.order_item_id)}
                              >
                                Download
                              </a>
                            </span>
                          </p>
                          <code className={styles.mutedPath}>{localFilePath(item)}</code>
                          <p className={styles.muted}>
                            Lab TIFF from print-output (sized for this order). Not the master TIFF.
                          </p>
                        </div>
                      ) : null}

                      {driveFolderUrl(item) ? (
                        <p>
                          <strong>Drive folder:</strong>{" "}
                          <a href={driveFolderUrl(item)!} target="_blank" rel="noreferrer">
                            Open in Google Drive
                          </a>
                          <button
                            className={styles.button}
                            type="button"
                            onClick={() => copyToClipboard(driveFolderUrl(item)!, "Pixel Perfect folder link")}
                          >
                            Copy folder link
                          </button>
                          <span className={styles.muted}>
                            {driveFileUrl(item)
                              ? " — TIFF is in this folder; enter the filename on the Pixel Perfect form"
                              : " — automatic upload was unavailable; upload the prepared print file manually"}
                          </span>
                        </p>
                      ) : null}

                      {driveFileUrl(item) && !driveFolderUrl(item) ? (
                        <p>
                          <strong>Drive file:</strong>{" "}
                          <a href={driveFileUrl(item)!} target="_blank" rel="noreferrer">
                            Open public TIFF in Google Drive
                          </a>
                        </p>
                      ) : null}

                      {!hasPreparedPrintFile(item) && !driveFileUrl(item) && item.cloud_file_url ? (
                        <p>
                          <strong>File URL:</strong> <code>{item.cloud_file_url}</code>
                        </p>
                      ) : null}

                      <p className={styles.muted}>
                        Email to admin@pixelperfect.com.au. They will invoice; pay separately. Paste the Drive folder
                        link and type the filename on their side if they ask.
                      </p>
                      <textarea className={styles.textarea} readOnly value={pixelPerfectEmail(item).body} rows={18} />
                    </>
                  ) : (
                    <p className={styles.muted}>
                      Prepared print file has not been written to print-output yet (fulfilment worker).
                    </p>
                  )}

                  <div className={styles.actionRow}>
                    <button
                      className={styles.button}
                      type="button"
                      disabled={!hasPreparedPrintFile(item) && !item.cloud_file_url}
                      onClick={() =>
                        copyToClipboard(pixelPerfectEmail(item).body, "Pixel Perfect order email")
                      }
                    >
                      Copy Pixel Perfect email
                    </button>
                    <a href={pixelPerfectEmail(item).mailtoHref}>Open in email app</a>
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
                    {isStudioItem(item) ? null : (
                      <button
                        className={styles.button}
                        type="button"
                        disabled={!item.tracking_number && !trackingNumbers[item.order_item_id]}
                        onClick={() => notifyCustomer(item)}
                      >
                        Notify Customer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      {previewItem ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-file-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="print-file-preview-title">{localPrintFileName(previewItem)}</h2>
                <p className={styles.muted}>{localFilePath(previewItem)}</p>
              </div>
              <button className={styles.buttonSecondary} type="button" onClick={() => setPreviewItem(null)}>
                Close
              </button>
            </div>
            <div className={styles.modalPreview}>
              {previewFailed ? (
                <p className={styles.muted}>
                  Preview unavailable. You can still download the TIFF for Pixel Perfect.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={printFilePreviewUrl(previewItem.order_item_id)}
                  alt={`Preview of ${localPrintFileName(previewItem)}`}
                  onError={() => setPreviewFailed(true)}
                />
              )}
            </div>
            <div className={styles.modalActions}>
              <a className={styles.button} href={printFileDownloadUrl(previewItem.order_item_id)}>
                Download prepared TIFF
              </a>
              <button
                className={styles.buttonSecondary}
                type="button"
                onClick={() => copyToClipboard(localFilePath(previewItem), "Prepared print file path")}
              >
                Copy path
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
