"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  campaignBlocksSchema,
  createCampaignBlockId,
  type CampaignBlock,
} from "../../lib/campaigns/blocks";
import type { EmailCampaign, EmailCampaignAudience } from "../../lib/supabase/types";
import styles from "./CampaignEditorClient.module.css";

type ProductAsset = {
  id: string;
  slug: string;
  title: string;
  is_available: boolean;
  image_url: string | null;
  alt_text: string | null;
};

type MediaAsset = {
  id: string;
  url_path: string;
  alt_text: string | null;
};

type CampaignStats = {
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
};

type CampaignEditorClientProps = {
  campaign: EmailCampaign;
  stats: CampaignStats;
  audienceCounts: {
    subscribers: number;
    talk_registrations: number;
  };
};

const readOnlyStatuses = new Set(["sending", "sent"]);

export function CampaignEditorClient({
  campaign: initial,
  stats: initialStats,
  audienceCounts,
}: CampaignEditorClientProps) {
  const router = useRouter();
  const readOnly = readOnlyStatuses.has(initial.status);

  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(initial.preview_text ?? "");
  const [blocks, setBlocks] = useState<CampaignBlock[]>(() => {
    const parsed = campaignBlocksSchema.safeParse(initial.blocks);
    return parsed.success ? parsed.data : [];
  });
  const [scheduledAtLocal, setScheduledAtLocal] = useState(() =>
    initial.scheduled_at ? toLocalInputValue(initial.scheduled_at) : "",
  );
  const [audience, setAudience] = useState<EmailCampaignAudience>(
    initial.audience === "talk_registrations" ? "talk_registrations" : "subscribers",
  );
  const [status, setStatus] = useState(initial.status);
  const [stats, setStats] = useState(initialStats);
  const [products, setProducts] = useState<ProductAsset[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedAudienceCount =
    audience === "talk_registrations"
      ? audienceCounts.talk_registrations
      : audienceCounts.subscribers;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/campaigns/assets");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          products?: ProductAsset[];
          media?: MediaAsset[];
        };
        if (!cancelled) {
          setProducts(body.products ?? []);
          setMedia(body.media ?? []);
        }
      } catch {
        // Keep empty pickers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = useMemo(
    () => products.filter((product) => product.image_url),
    [products],
  );

  const save = async (extra?: {
    status?: "draft" | "scheduled" | "cancelled";
    scheduled_at?: string | null;
    audience?: EmailCampaignAudience;
  }) => {
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          preview_text: previewText || null,
          blocks,
          audience: extra?.audience ?? audience,
          ...extra,
        }),
      });
      const body = (await response.json().catch(() => null)) as EmailCampaign & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body?.error ?? "Save failed.");
      }
      setStatus(body.status);
      setMessage("Saved.");
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const refreshPreview = async () => {
    const saved = readOnly ? initial : await save();
    if (!saved && !readOnly) return;
    setBusy("preview");
    setError(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${initial.id}/preview`);
      const body = (await response.json().catch(() => null)) as {
        html?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.html) {
        throw new Error(body?.error ?? "Preview failed.");
      }
      setPreviewHtml(body.html);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    const saved = await save();
    if (!saved) return;
    if (!testEmail.trim()) {
      setError("Enter a test email address.");
      return;
    }
    setBusy("test");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${initial.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Test send failed.");
      }
      setMessage(`Test email sent to ${testEmail.trim()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test send failed.");
    } finally {
      setBusy(null);
    }
  };

  const sendNow = async () => {
    const listLabel =
      audience === "talk_registrations" ? "talk registrations" : "website subscribers";
    if (
      !window.confirm(
        `Send this campaign to ${selectedAudienceCount} ${listLabel}?`,
      )
    ) {
      return;
    }
    const saved = await save({ status: "draft", scheduled_at: null, audience });
    if (!saved) return;
    setBusy("send");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${initial.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        sent?: number;
        failed?: number;
        audience?: number;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Send failed.");
      }
      setStatus("sent");
      setStats({
        sent: body?.sent ?? 0,
        failed: body?.failed ?? 0,
        skipped: 0,
        pending: 0,
      });
      setMessage(
        `Sent to ${body?.sent ?? 0} of ${body?.audience ?? selectedAudienceCount} (failed: ${body?.failed ?? 0}).`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy(null);
    }
  };

  const schedule = async () => {
    if (!scheduledAtLocal) {
      setError("Pick a schedule date and time.");
      return;
    }
    const iso = new Date(scheduledAtLocal).toISOString();
    const saved = await save({ status: "scheduled", scheduled_at: iso });
    if (saved) {
      setMessage(`Scheduled for ${new Date(iso).toLocaleString()}.`);
    }
  };

  const clearSchedule = async () => {
    setScheduledAtLocal("");
    const saved = await save({ status: "draft", scheduled_at: null });
    if (saved) setMessage("Schedule cleared — campaign is a draft again.");
  };

  const updateBlock = (id: string, patch: Partial<CampaignBlock>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? ({ ...block, ...patch } as CampaignBlock) : block)),
    );
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
  };

  const addBlock = (type: CampaignBlock["type"]) => {
    const id = createCampaignBlockId();
    if (type === "heading") {
      setBlocks((current) => [...current, { id, type, text: "New heading" }]);
    } else if (type === "paragraph") {
      setBlocks((current) => [...current, { id, type, text: "" }]);
    } else if (type === "image") {
      setBlocks((current) => [...current, { id, type, url: "", alt: "" }]);
    } else if (type === "button") {
      setBlocks((current) => [
        ...current,
        { id, type, label: "Visit the shop", url: "/shop" },
      ]);
    } else if (type === "product") {
      const first = productOptions[0];
      if (!first?.image_url) {
        setError("No print products with images are available to insert.");
        return;
      }
      const imageUrl = first.image_url;
      setBlocks((current) => [
        ...current,
        {
          id,
          type,
          product_id: first.id,
          slug: first.slug,
          title: first.title,
          image_url: imageUrl,
          cta_label: "View print",
        },
      ]);
    }
  };

  const insertProduct = (product: ProductAsset) => {
    if (!product.image_url) return;
    const imageUrl = product.image_url;
    setBlocks((current) => [
      ...current,
      {
        id: createCampaignBlockId(),
        type: "product",
        product_id: product.id,
        slug: product.slug,
        title: product.title,
        image_url: imageUrl,
        cta_label: "View print",
      },
    ]);
  };

  const insertMediaImage = (file: MediaAsset) => {
    setBlocks((current) => [
      ...current,
      {
        id: createCampaignBlockId(),
        type: "image",
        url: file.url_path,
        alt: file.alt_text || "",
      },
    ]);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <p className={styles.back}>
            <Link href="/admin/campaigns">← Campaigns</Link>
          </p>
          <h1>{readOnly ? "Campaign" : "Edit campaign"}</h1>
          <p className={styles.meta}>
            Status: <strong>{status}</strong>
            {" · "}
            Website subscribers: {audienceCounts.subscribers}
            {" · "}
            Talk registrations: {audienceCounts.talk_registrations}
            {(status === "sent" || status === "failed") && (
              <>
                {" · "}
                Stats: {stats.sent} sent, {stats.failed} failed
              </>
            )}
          </p>
        </div>
      </div>

      {readOnly ? (
        <p className={styles.notice}>
          This campaign has been sent (or is sending). Clone it from the campaigns list to reuse the
          content.
        </p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.layout}>
        <div className={styles.editor}>
          <label className={styles.field}>
            Internal name
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={readOnly} />
          </label>
          <label className={styles.field}>
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={readOnly}
              placeholder="New prints from Redgate"
            />
          </label>
          <label className={styles.field}>
            Preview text
            <input
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              disabled={readOnly}
              placeholder="Shown in inbox next to the subject"
            />
          </label>

          <div className={styles.blockToolbar}>
            <span>Add block</span>
            <button type="button" disabled={readOnly} onClick={() => addBlock("heading")}>
              Heading
            </button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("paragraph")}>
              Paragraph
            </button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("image")}>
              Image
            </button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("product")}>
              Product
            </button>
            <button type="button" disabled={readOnly} onClick={() => addBlock("button")}>
              Button
            </button>
          </div>

          <div className={styles.blocks}>
            {blocks.map((block, index) => (
              <div key={block.id} className={styles.blockCard}>
                <div className={styles.blockHeader}>
                  <strong>{block.type}</strong>
                  <div className={styles.blockActions}>
                    <button type="button" disabled={readOnly || index === 0} onClick={() => moveBlock(block.id, -1)}>
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={readOnly || index === blocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      Down
                    </button>
                    <button type="button" disabled={readOnly} onClick={() => removeBlock(block.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {block.type === "heading" || block.type === "paragraph" ? (
                  <textarea
                    className={styles.textarea}
                    rows={block.type === "heading" ? 2 : 4}
                    value={block.text}
                    disabled={readOnly}
                    onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                  />
                ) : null}

                {block.type === "image" ? (
                  <div className={styles.grid2}>
                    <label>
                      Image URL
                      <input
                        value={block.url}
                        disabled={readOnly}
                        onChange={(event) => updateBlock(block.id, { url: event.target.value })}
                        placeholder="/images/… or https://…"
                      />
                    </label>
                    <label>
                      Alt text
                      <input
                        value={block.alt || ""}
                        disabled={readOnly}
                        onChange={(event) => updateBlock(block.id, { alt: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}

                {block.type === "button" ? (
                  <div className={styles.grid2}>
                    <label>
                      Label
                      <input
                        value={block.label}
                        disabled={readOnly}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      URL
                      <input
                        value={block.url}
                        disabled={readOnly}
                        onChange={(event) => updateBlock(block.id, { url: event.target.value })}
                        placeholder="/shop or https://…"
                      />
                    </label>
                  </div>
                ) : null}

                {block.type === "product" ? (
                  <div className={styles.grid2}>
                    <label>
                      Product
                      <select
                        value={block.product_id}
                        disabled={readOnly}
                        onChange={(event) => {
                          const product = productOptions.find((item) => item.id === event.target.value);
                          if (!product?.image_url) return;
                          const imageUrl = product.image_url;
                          updateBlock(block.id, {
                            product_id: product.id,
                            slug: product.slug,
                            title: product.title,
                            image_url: imageUrl,
                          });
                        }}
                      >
                        {productOptions.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Button label
                      <input
                        value={block.cta_label || "View print"}
                        disabled={readOnly}
                        onChange={(event) => updateBlock(block.id, { cta_label: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} disabled={readOnly || busy !== null} onClick={() => void save()}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void refreshPreview()}>
              {busy === "preview" ? "Loading preview…" : "Refresh preview"}
            </button>
          </div>

          <div className={styles.sendPanel}>
            <h2>Send</h2>
            <fieldset className={styles.audienceFieldset} disabled={readOnly}>
              <legend>Send to</legend>
              <label className={styles.audienceOption}>
                <input
                  type="radio"
                  name="campaign-audience"
                  checked={audience === "subscribers"}
                  onChange={() => setAudience("subscribers")}
                />
                <span>
                  Website subscribers
                  <span className={styles.audienceCount}> ({audienceCounts.subscribers})</span>
                </span>
              </label>
              <label className={styles.audienceOption}>
                <input
                  type="radio"
                  name="campaign-audience"
                  checked={audience === "talk_registrations"}
                  onChange={() => setAudience("talk_registrations")}
                />
                <span>
                  Talk registrations
                  <span className={styles.audienceCount}> ({audienceCounts.talk_registrations})</span>
                </span>
              </label>
            </fieldset>
            <div className={styles.testRow}>
              <input
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={readOnly}
              />
              <button type="button" disabled={readOnly || busy !== null} onClick={() => void sendTest()}>
                {busy === "test" ? "Sending test…" : "Send test"}
              </button>
            </div>
            <div className={styles.scheduleRow}>
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(event) => setScheduledAtLocal(event.target.value)}
                disabled={readOnly}
              />
              <button type="button" disabled={readOnly || busy !== null} onClick={() => void schedule()}>
                Schedule
              </button>
              <button type="button" disabled={readOnly || busy !== null} onClick={() => void clearSchedule()}>
                Clear schedule
              </button>
            </div>
            <p className={styles.hint}>
              Scheduled sends use the list selected above. They run when{" "}
              <code>/api/admin/campaigns/process-scheduled</code> is called (admin session or Bearer
              CRON_SECRET / FULFILMENT_API_KEY).
            </p>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={readOnly || busy !== null || selectedAudienceCount === 0}
              onClick={() => void sendNow()}
            >
              {busy === "send"
                ? "Sending…"
                : `Send now to ${selectedAudienceCount} ${
                    audience === "talk_registrations" ? "talk registrations" : "subscribers"
                  }`}
            </button>
          </div>
        </div>

        <aside className={styles.sidebar}>
          <section className={styles.picker}>
            <h2>Insert print</h2>
            <div className={styles.pickerList}>
              {productOptions.slice(0, 40).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={styles.pickerItem}
                  disabled={readOnly}
                  onClick={() => insertProduct(product)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.image_url!} alt="" />
                  <span>{product.title}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.picker}>
            <h2>Insert media image</h2>
            <div className={styles.pickerList}>
              {media.slice(0, 40).map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className={styles.pickerItem}
                  disabled={readOnly}
                  onClick={() => insertMediaImage(file)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.url_path} alt="" />
                  <span>{file.alt_text || file.url_path}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.preview}>
            <h2>Preview</h2>
            {previewHtml ? (
              <iframe title="Email preview" className={styles.iframe} srcDoc={previewHtml} />
            ) : (
              <p className={styles.hint}>Save and refresh preview to see the branded email.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

const toLocalInputValue = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
