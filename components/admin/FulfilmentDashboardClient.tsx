"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import { LAB_ORDER_EMAIL, buildLabOrderEmail } from "../../lib/lab-order-email";
import { formatLabDimensions } from "../../lib/print-size";
import { formatStudioOrderOption, isStudioOrderNotes, type OpenStudioOrder } from "../../lib/studio-orders";
import { formatAUD } from "../../lib/utils/currency";
import { loadOpenStudioOrders } from "../StudioOrderDestinationDialog";
import styles from "./FulfilmentDashboardClient.module.css";

type FulfilmentEvent = {
  id: string;
  event_type: string;
  notes: string | null;
  created_at: string;
};

export type FulfilmentDashboardItem = {
  order_item_id: string;
  order_id?: string;
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
  fulfilment_provider?: "posterfactory" | "pixelperfect" | null;
  fulfilment_class?: "standard" | "fine_art" | "framed" | "canvas" | null;
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

type OrderGroup = {
  order_number: string;
  items: FulfilmentDashboardItem[];
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

const groupStatusOptions = [
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

const labOrderEmailItem = (item: FulfilmentDashboardItem) => ({
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
  drive_file_url: driveFileUrl(item),
  drive_folder_url: driveFolderUrl(item),
  filename: localPrintFileName(item),
  canvas_wrap_mm: item.canvas_wrap_mm,
  wrap_style: item.wrap_style,
});

const studioStatusesForLabEmail = new Set(["awaiting_file", "file_ready"]);

const groupItemsByOrder = (items: FulfilmentDashboardItem[]): OrderGroup[] => {
  const groups: OrderGroup[] = [];
  const indexByOrder = new Map<string, number>();

  items.forEach((item) => {
    const existing = indexByOrder.get(item.order_number);
    if (existing === undefined) {
      indexByOrder.set(item.order_number, groups.length);
      groups.push({ order_number: item.order_number, items: [item] });
      return;
    }
    groups[existing].items.push(item);
  });

  return groups;
};

const formatStatusLabel = (status: string): string => status.replaceAll("_", " ");

const statusSummary = (items: FulfilmentDashboardItem[]): string => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    counts.set(item.fulfilment_status, (counts.get(item.fulfilment_status) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([status, count]) => `${count} ${formatStatusLabel(status)}`)
    .join(" · ");
};

const sharedTracking = (items: FulfilmentDashboardItem[]): { value: string; mixed: boolean } => {
  const values = [...new Set(items.map((item) => (item.tracking_number ?? "").trim()))];
  if (values.length === 1) return { value: values[0], mixed: false };
  return { value: "", mixed: values.length > 1 };
};

export function FulfilmentDashboardClient({ items, fetchedAt }: FulfilmentDashboardClientProps) {
  const router = useRouter();
  const knownItemIdsRef = useRef(new Set<string>());
  const [statusFilter, setStatusFilter] = useState("in_process");
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((item) => item.order_item_id)),
  );
  const [orderTracking, setOrderTracking] = useState<Record<string, string>>({});
  const [orderStatus, setOrderStatus] = useState<Record<string, string>>({});
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [openStudioOrders, setOpenStudioOrders] = useState<OpenStudioOrder[]>([]);
  const [applyingOrder, setApplyingOrder] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FulfilmentDashboardItem | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [refs, setRefs] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.order_item_id, item.pixel_perfect_order_ref ?? ""])),
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set<string>();
      items.forEach((item) => {
        const isNew = !knownItemIdsRef.current.has(item.order_item_id);
        if (isNew || current.has(item.order_item_id)) next.add(item.order_item_id);
      });
      return next;
    });
    knownItemIdsRef.current = new Set(items.map((item) => item.order_item_id));
    setRefs(Object.fromEntries(items.map((item) => [item.order_item_id, item.pixel_perfect_order_ref ?? ""])));
    void loadOpenStudioOrders()
      .then(setOpenStudioOrders)
      .catch(() => setOpenStudioOrders([]));
  }, [items]);

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

  const copyToClipboard = async (value: string, label: string, html?: string): Promise<boolean> => {
    try {
      if (html && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([value], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(value);
      }
      setError(null);
      setMessage(`${label} copied.`);
      return true;
    } catch {
      try {
        await navigator.clipboard.writeText(value);
        setError(null);
        setMessage(`${label} copied.`);
        return true;
      } catch {
        setMessage(null);
        setError(`Could not copy ${label.toLowerCase()}.`);
        return false;
      }
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

  const orderGroups = useMemo(() => groupItemsByOrder(filteredItems), [filteredItems]);

  const studioLabEmail = useMemo(() => {
    const studioItems = items.filter(
      (item) => isStudioItem(item) && studioStatusesForLabEmail.has(item.fulfilment_status),
    );
    if (studioItems.length === 0) return null;
    const countsByOrder = new Map<string, number>();
    studioItems.forEach((item) => {
      countsByOrder.set(item.order_number, (countsByOrder.get(item.order_number) ?? 0) + 1);
    });
    const orderSummary = [...countsByOrder.entries()]
      .map(([orderNumber, count]) => `${orderNumber}: ${count}`)
      .join(" · ");
    return {
      count: studioItems.length,
      items: studioItems,
      orderSummary,
      ...buildLabOrderEmail(studioItems.map(labOrderEmailItem)),
    };
  }, [items]);

  const toggleSetValue = (current: Set<string>, value: string, enabled: boolean): Set<string> => {
    const next = new Set(current);
    if (enabled) next.add(value);
    else next.delete(value);
    return next;
  };

  const setItemSelected = (itemId: string, selected: boolean) => {
    setSelectedIds((current) => toggleSetValue(current, itemId, selected));
  };

  const setGroupSelected = (group: OrderGroup, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      group.items.forEach((item) => {
        if (selected) next.add(item.order_item_id);
        else next.delete(item.order_item_id);
      });
      return next;
    });
  };

  const patchItem = async (itemId: string, body: Record<string, unknown>): Promise<boolean> => {
    const response = await adminClientFetch(`/api/admin/fulfilment/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Fulfilment update failed.");
      return false;
    }

    return true;
  };

  const applyToItems = async (
    targetItems: FulfilmentDashboardItem[],
    fulfilmentStatus: string,
    successLabel: string,
  ) => {
    if (targetItems.length === 0) return;

    setError(null);
    setMessage(null);
    setApplyingOrder(successLabel);

    try {
      for (const item of targetItems) {
        const ok = await patchItem(item.order_item_id, { fulfilment_status: fulfilmentStatus });
        if (!ok) {
          router.refresh();
          return;
        }
      }

      setMessage(
        `Updated ${targetItems.length} print${targetItems.length === 1 ? "" : "s"} to ${formatStatusLabel(fulfilmentStatus)}.`,
      );
      router.refresh();
    } catch (patchError) {
      setError(adminClientFetchError(patchError));
    } finally {
      setApplyingOrder(null);
    }
  };

  const applyToGroup = async (group: OrderGroup, fulfilmentStatus: string) => {
    const selected = group.items.filter((item) => selectedIds.has(item.order_item_id));
    if (selected.length === 0) return;

    setError(null);
    setMessage(null);
    setApplyingOrder(group.order_number);

    const tracking = (orderTracking[group.order_number] ?? sharedTracking(selected).value).trim();
    const body: Record<string, unknown> = { fulfilment_status: fulfilmentStatus };
    if (tracking) body.tracking_number = tracking;

    try {
      for (const item of selected) {
        const ok = await patchItem(item.order_item_id, body);
        if (!ok) {
          router.refresh();
          return;
        }
      }

      setMessage(
        `Updated ${selected.length} print${selected.length === 1 ? "" : "s"} on ${group.order_number} to ${formatStatusLabel(fulfilmentStatus)}.`,
      );
      router.refresh();
    } catch (patchError) {
      setError(adminClientFetchError(patchError));
    } finally {
      setApplyingOrder(null);
    }
  };

  const copyStudioOrderEmail = async () => {
    if (!studioLabEmail) return;
    const copied = await copyToClipboard(
      studioLabEmail.body,
      "Studio lab order email",
      studioLabEmail.html,
    );
    if (!copied) return;
    const confirmed = window.confirm(
      `Mark these ${studioLabEmail.count} studio prints as submitted to the lab?\n${studioLabEmail.orderSummary}`,
    );
    if (!confirmed) return;
    await applyToItems(studioLabEmail.items, "submitted_to_lab", "studio-email");
  };

  const markStudioGroupSubmitted = async (group: OrderGroup) => {
    const waiting = group.items.filter((item) => studioStatusesForLabEmail.has(item.fulfilment_status));
    if (waiting.length === 0) return;
    const confirmed = window.confirm(
      `Mark ${waiting.length} print${waiting.length === 1 ? "" : "s"} on ${group.order_number} as submitted to the lab?`,
    );
    if (!confirmed) return;
    await applyToItems(waiting, "submitted_to_lab", group.order_number);
  };

  const moveSelectedToOrder = async (group: OrderGroup) => {
    const selected = group.items.filter((item) => selectedIds.has(item.order_item_id));
    const targetOrderId = moveTargets[group.order_number];
    if (selected.length === 0 || !targetOrderId) return;

    setError(null);
    setMessage(null);
    setApplyingOrder(group.order_number);

    try {
      const response = await adminClientFetch("/api/admin/fulfilment/move-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_item_ids: selected.map((item) => item.order_item_id),
          target_order_id: targetOrderId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; moved?: number; target_order_number?: string; cancelled_order_numbers?: string[] }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Could not move prints onto that studio order.");
        return;
      }

      const cancelled = payload?.cancelled_order_numbers?.length
        ? ` Closed ${payload.cancelled_order_numbers.join(", ")}.`
        : "";
      setMessage(
        `Moved ${payload?.moved ?? selected.length} print${(payload?.moved ?? selected.length) === 1 ? "" : "s"} onto ${payload?.target_order_number ?? "studio order"}.${cancelled}`,
      );
      setMoveTargets((prev) => ({ ...prev, [group.order_number]: "" }));
      router.refresh();
    } catch (moveError) {
      setError(adminClientFetchError(moveError));
    } finally {
      setApplyingOrder(null);
    }
  };

  const saveLabReference = async (item: FulfilmentDashboardItem) => {
    setError(null);
    setMessage(null);

    try {
      const ok = await patchItem(item.order_item_id, {
        fulfilment_status: "submitted_to_lab",
        pixel_perfect_order_ref: refs[item.order_item_id] || null,
      });
      if (!ok) return;
      setMessage(`Saved Pixel Perfect reference for ${item.order_number}.`);
      router.refresh();
    } catch (patchError) {
      setError(adminClientFetchError(patchError));
    }
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
          onClick={() => setExpandedOrderIds(new Set(orderGroups.map((group) => group.order_number)))}
        >
          Expand all
        </button>
        <button
          type="button"
          className={styles.buttonSecondary}
          onClick={() => setExpandedOrderIds(new Set())}
        >
          Collapse all
        </button>
        <span className={styles.muted}>Fetched {new Date(fetchedAt).toLocaleString("en-AU")}</span>
      </div>

      <div className={styles.studioEmailBar}>
        {studioLabEmail ? (
          <>
            <p className={styles.muted}>
              {studioLabEmail.count} studio print{studioLabEmail.count === 1 ? "" : "s"} waiting for the lab
              {studioLabEmail.orderSummary ? ` (${studioLabEmail.orderSummary})` : ""}. One email to{" "}
              {LAB_ORDER_EMAIL} — they invoice; you pay separately.
            </p>
            <div className={styles.actionRow}>
              <button
                className={styles.button}
                type="button"
                disabled={applyingOrder !== null}
                onClick={() => void copyStudioOrderEmail()}
              >
                Copy studio order email
              </button>
            </div>
          </>
        ) : (
          <p className={styles.muted}>No studio orders waiting for the lab (awaiting file or file ready).</p>
        )}
      </div>

      {message ? <p>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.grid}>
        {orderGroups.length === 0 ? <p className={styles.muted}>No orders match this filter.</p> : null}
        {orderGroups.map((group) => {
          const first = group.items[0];
          const currentOrderId =
            first.order_id ??
            openStudioOrders.find((order) => order.order_number === group.order_number)?.order_id;
          const moveCandidates = openStudioOrders.filter((order) => order.order_id !== currentOrderId);
          const isOrderExpanded = expandedOrderIds.has(group.order_number);
          const isStudioOrder = group.items.some(isStudioItem);
          const selectedInGroup = group.items.filter((item) => selectedIds.has(item.order_item_id));
          const trackingState = sharedTracking(selectedInGroup);
          const trackingValue = orderTracking[group.order_number] ?? trackingState.value;
          const statusValue = orderStatus[group.order_number] ?? "shipped";
          const isApplying = applyingOrder === group.order_number;
          const applyDisabled = selectedInGroup.length === 0 || isApplying;
          const orderedAt = orderDate(first);

          return (
            <details
              className={styles.card}
              key={group.order_number}
              open={isOrderExpanded}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setExpandedOrderIds((current) => toggleSetValue(current, group.order_number, nextOpen));
              }}
            >
              <summary className={styles.cardSummary}>
                <div className={styles.summaryMain}>
                  <span className={styles.chevron} aria-hidden="true">
                    {isOrderExpanded ? "▾" : "▸"}
                  </span>
                  <div>
                    <h2>{group.order_number}</h2>
                    <p className={styles.summaryMeta}>
                      <span className={styles.summaryCustomer}>
                        {first.customer_name?.trim() || first.customer_email || "Unknown customer"}
                      </span>
                      <span>·</span>
                      <span>
                        {group.items.length} print{group.items.length === 1 ? "" : "s"}
                      </span>
                      <span>·</span>
                      <span>Ordered {formatDateTime(orderedAt)}</span>
                    </p>
                    <p className={styles.statusSummary}>{statusSummary(group.items)}</p>
                  </div>
                </div>
                <div className={styles.summaryBadges}>
                  {isStudioOrder ? <span className={styles.studioBadge}>Studio</span> : null}
                </div>
              </summary>

              <div className={styles.cardBody}>
                <div className={styles.groupBar}>
                  <SelectAllCheckbox
                    items={group.items}
                    selectedIds={selectedIds}
                    disabled={isApplying}
                    onChange={(selected) => setGroupSelected(group, selected)}
                  />
                  <input
                    className={`${styles.field} ${styles.trackingField}`}
                    value={trackingValue}
                    disabled={isApplying}
                    onChange={(event) =>
                      setOrderTracking((prev) => ({ ...prev, [group.order_number]: event.target.value }))
                    }
                    placeholder={trackingState.mixed ? "Mixed tracking numbers" : "Tracking number"}
                  />
                  {trackingState.mixed && !orderTracking[group.order_number] ? (
                    <span className={styles.mixedHint}>Mixed</span>
                  ) : null}
                  <select
                    className={styles.field}
                    value={statusValue}
                    disabled={isApplying}
                    onChange={(event) =>
                      setOrderStatus((prev) => ({ ...prev, [group.order_number]: event.target.value }))
                    }
                  >
                    {groupStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.button}
                    type="button"
                    disabled={applyDisabled}
                    onClick={() => applyToGroup(group, statusValue)}
                  >
                    Apply to {selectedInGroup.length} selected
                  </button>
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    disabled={applyDisabled}
                    onClick={() => applyToGroup(group, "delivered")}
                  >
                    Mark delivered
                  </button>
                  {isStudioOrder ? (
                    <>
                      {group.items.some((item) => studioStatusesForLabEmail.has(item.fulfilment_status)) ? (
                        <button
                          className={styles.buttonSecondary}
                          type="button"
                          disabled={isApplying}
                          onClick={() => void markStudioGroupSubmitted(group)}
                        >
                          Mark submitted to lab
                        </button>
                      ) : null}
                      <select
                        className={styles.field}
                        value={moveTargets[group.order_number] ?? ""}
                        disabled={isApplying}
                        onChange={(event) =>
                          setMoveTargets((prev) => ({ ...prev, [group.order_number]: event.target.value }))
                        }
                      >
                        <option value="">Move to order…</option>
                        {moveCandidates.map((order) => (
                            <option key={order.order_id} value={order.order_id}>
                              {formatStudioOrderOption(order)}
                            </option>
                          ))}
                      </select>
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        disabled={applyDisabled || !moveTargets[group.order_number] || moveCandidates.length === 0}
                        onClick={() => void moveSelectedToOrder(group)}
                      >
                        Move selected
                      </button>
                    </>
                  ) : null}
                </div>

                <div className={styles.imageList}>
                  {group.items.map((item) => {
                    const isItemExpanded = expandedItemIds.has(item.order_item_id);
                    const isSelected = selectedIds.has(item.order_item_id);
                    const timeline = statusTimeline(item);

                    return (
                      <details
                        className={styles.imageCard}
                        key={item.order_item_id}
                        open={isItemExpanded}
                        onToggle={(event) => {
                          const nextOpen = event.currentTarget.open;
                          setExpandedItemIds((current) =>
                            toggleSetValue(current, item.order_item_id, nextOpen),
                          );
                        }}
                      >
                        <summary className={styles.imageSummary}>
                          <div className={styles.imageSummaryMain}>
                            <input
                              className={styles.checkbox}
                              type="checkbox"
                              checked={isSelected}
                              disabled={isApplying}
                              aria-label={`Select ${item.photo_title || item.title}`}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              onChange={(event) => setItemSelected(item.order_item_id, event.target.checked)}
                            />
                            <span className={styles.chevron} aria-hidden="true">
                              {isItemExpanded ? "▾" : "▸"}
                            </span>
                            <div>
                              <h3>{item.photo_title || item.title}</h3>
                              <p className={styles.summaryMeta}>{item.variant_label}</p>
                            </div>
                          </div>
                          <span className={styles.status}>{formatStatusLabel(item.fulfilment_status)}</span>
                        </summary>

                        <div className={styles.imageBody}>
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
                            <p>
                              <strong>Lab:</strong>{" "}
                              {item.fulfilment_provider === "posterfactory"
                                ? "PosterFactory"
                                : item.fulfilment_provider === "pixelperfect"
                                  ? "Pixel Perfect"
                                  : "—"}
                            </p>
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
                            <p><strong>Tracking:</strong> {item.tracking_number ?? "—"}</p>
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
                                        ? isStudioItem(item)
                                          ? " — TIFF is in this folder; filename is in the studio order email"
                                          : " — TIFF is in this folder; enter the filename on the Pixel Perfect form"
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
                              </>
                            ) : (
                              <p className={styles.muted}>
                                Prepared print file has not been written to print-output yet (fulfilment worker).
                              </p>
                            )}

                            {isStudioItem(item) && studioStatusesForLabEmail.has(item.fulfilment_status) ? (
                              <p className={styles.muted}>
                                Included in the studio order email at the top of this page (all studio prints waiting for the lab).
                              </p>
                            ) : null}

                            <div className={styles.actionRow}>
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
                              {isStudioItem(item) ? null : (
                                <button
                                  className={styles.button}
                                  type="button"
                                  disabled={!item.tracking_number}
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

function SelectAllCheckbox({
  items,
  selectedIds,
  disabled,
  onChange,
}: {
  items: FulfilmentDashboardItem[];
  selectedIds: Set<string>;
  disabled?: boolean;
  onChange: (selected: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.order_item_id));
  const someSelected = items.some((item) => selectedIds.has(item.order_item_id));

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected && !allSelected;
  }, [allSelected, someSelected]);

  return (
    <label className={styles.selectAll}>
      <input
        ref={ref}
        className={styles.checkbox}
        type="checkbox"
        checked={allSelected}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      Select all
    </label>
  );
}
