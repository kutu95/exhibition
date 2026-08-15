"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  createCampaignBlockId,
  type CampaignBlock,
} from "../../lib/campaigns/blocks";
import type { EmailTemplateDefinition } from "../../lib/emails/template-defs";
import type { EmailTemplateRecord } from "../../lib/emails/templates";
import styles from "./CampaignEditorClient.module.css";
import { ParagraphTextField } from "./ParagraphTextField";

type ProductAsset = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
};

type MediaAsset = {
  id: string;
  url_path: string;
  alt_text: string | null;
};

type EmailTemplateEditorClientProps = {
  template: EmailTemplateRecord;
  definition: EmailTemplateDefinition;
};

export function EmailTemplateEditorClient({
  template: initial,
  definition,
}: EmailTemplateEditorClientProps) {
  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(initial.preview_text ?? "");
  const [blocks, setBlocks] = useState<CampaignBlock[]>(initial.blocks);
  const [products, setProducts] = useState<ProductAsset[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

  const draftRef = useRef({ subject, previewText, blocks });
  draftRef.current = { subject, previewText, blocks };
  const dirtyRef = useRef(false);
  const saveAgainRef = useRef(false);
  const persistRunRef = useRef<Promise<boolean> | null>(null);
  const lastSavedRef = useRef(
    JSON.stringify({
      subject: initial.subject,
      previewText: initial.preview_text ?? "",
      blocks: initial.blocks,
    }),
  );
  const persistRef = useRef<() => Promise<boolean>>(async () => true);

  const persist = (): Promise<boolean> => {
    saveAgainRef.current = true;
    if (persistRunRef.current) return persistRunRef.current;

    const run = (async () => {
      await Promise.resolve();
      let ok = false;
      try {
        while (saveAgainRef.current) {
          saveAgainRef.current = false;
          const draft = draftRef.current;
          const snapshot = JSON.stringify({
            subject: draft.subject,
            previewText: draft.previewText,
            blocks: draft.blocks,
          });
          if (snapshot === lastSavedRef.current) {
            dirtyRef.current = false;
            setSaveStatus("saved");
            ok = true;
            continue;
          }
          setSaveStatus("saving");
          const response = await fetch(`/api/admin/email-templates/${initial.slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject: draft.subject,
              preview_text: draft.previewText.trim() || null,
              blocks: draft.blocks,
            }),
            keepalive: true,
          });
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          if (!response.ok) {
            setSaveStatus("error");
            setError(body?.error ?? "Could not save template.");
            return false;
          }
          lastSavedRef.current = snapshot;
          if (!saveAgainRef.current) {
            dirtyRef.current = false;
            setSaveStatus("saved");
          }
          ok = true;
        }
        return ok;
      } catch {
        setSaveStatus("error");
        setError("Could not save template.");
        return false;
      } finally {
        persistRunRef.current = null;
      }
    })();

    persistRunRef.current = run;
    return run;
  };
  persistRef.current = persist;

  useEffect(() => {
    const snapshot = JSON.stringify({ subject, previewText, blocks });
    if (snapshot === lastSavedRef.current) return;
    dirtyRef.current = true;
    setSaveStatus("unsaved");
    const timer = window.setTimeout(() => {
      void persistRef.current();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [subject, previewText, blocks]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      void persistRef.current();
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/campaigns/assets");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { products?: ProductAsset[]; media?: MediaAsset[] };
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

  const save = async (): Promise<boolean> => {
    setBusy("save");
    setMessage(null);
    const ok = await persist();
    setBusy(null);
    if (ok) setMessage("Saved.");
    return ok;
  };

  const refreshPreview = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy("preview");
    try {
      const response = await fetch(`/api/admin/email-templates/${initial.slug}/preview`);
      const body = (await response.json().catch(() => null)) as { html?: string; error?: string } | null;
      if (!response.ok || !body?.html) {
        setError(body?.error ?? "Could not render preview.");
        return;
      }
      setPreviewHtml(body.html);
    } catch {
      setError("Could not render preview.");
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
    try {
      const response = await fetch(`/api/admin/email-templates/${initial.slug}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Test send failed.");
        return;
      }
      setMessage(`Test sent to ${testEmail.trim()}.`);
    } catch {
      setError("Test send failed.");
    } finally {
      setBusy(null);
    }
  };

  const updateBlock = (id: string, patch: Partial<CampaignBlock>) => {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? ({ ...block, ...patch } as CampaignBlock) : block)),
    );
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id));
  };

  const addBlock = (type: CampaignBlock["type"], slot?: "order_summary" | "shipment_details") => {
    const id = createCampaignBlockId();
    if (type === "heading") {
      setBlocks((current) => [...current, { id, type, text: "New heading" }]);
    } else if (type === "paragraph") {
      setBlocks((current) => [...current, { id, type, text: "" }]);
    } else if (type === "image") {
      setBlocks((current) => [...current, { id, type, url: "", alt: "" }]);
    } else if (type === "button") {
      setBlocks((current) => [...current, { id, type, label: "Visit the shop", url: "/shop" }]);
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
    } else if (type === "merge" && slot) {
      setBlocks((current) => [...current, { id, type, slot }]);
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
      { id: createCampaignBlockId(), type: "image", url: file.url_path, alt: file.alt_text || "" },
    ]);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <p className={styles.back}>
            <Link href="/admin/email-designs">← Email designs</Link>
          </p>
          <h1>{definition.name}</h1>
          <p className={styles.meta}>
            {definition.description}
            {" · "}
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "unsaved"
                ? "Unsaved changes"
                : saveStatus === "error"
                  ? "Save failed"
                  : "Saved"}
          </p>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.layout}>
        <div className={styles.editor}>
          <label className={styles.field}>
            Subject
            <input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className={styles.field}>
            Preview text
            <input
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value)}
              placeholder="Shown in inbox next to the subject"
            />
          </label>

          <p className={styles.hint}>
            Merge fields:{" "}
            {definition.tokens.map((item) => item.token).join(" · ")}
          </p>

          <div className={styles.blockToolbar}>
            <span>Add block</span>
            <button type="button" onClick={() => addBlock("heading")}>
              Heading
            </button>
            <button type="button" onClick={() => addBlock("paragraph")}>
              Paragraph
            </button>
            <button type="button" onClick={() => addBlock("image")}>
              Image
            </button>
            <button type="button" onClick={() => addBlock("product")}>
              Product
            </button>
            <button type="button" onClick={() => addBlock("button")}>
              Button
            </button>
            {initial.slug === "order_confirmation" ? (
              <button type="button" onClick={() => addBlock("merge", "order_summary")}>
                Order details
              </button>
            ) : null}
            {initial.slug === "order_shipped" ? (
              <button type="button" onClick={() => addBlock("merge", "shipment_details")}>
                Shipment details
              </button>
            ) : null}
          </div>

          <div className={styles.blocks}>
            {blocks.map((block, index) => (
              <div key={block.id} className={styles.blockCard}>
                <div className={styles.blockHeader}>
                  <strong>
                    {block.type === "merge"
                      ? block.slot === "order_summary"
                        ? "order details"
                        : "shipment details"
                      : block.type}
                  </strong>
                  <div className={styles.blockActions}>
                    <button type="button" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                    >
                      Down
                    </button>
                    <button type="button" onClick={() => removeBlock(block.id)}>
                      Remove
                    </button>
                  </div>
                </div>

                {block.type === "heading" ? (
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={block.text}
                    onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                  />
                ) : null}

                {block.type === "paragraph" ? (
                  <ParagraphTextField
                    value={block.text}
                    onChange={(text) => updateBlock(block.id, { text })}
                  />
                ) : null}

                {block.type === "merge" ? (
                  <p className={styles.hint}>
                    Filled automatically when the email is sent (order lines, total, tracking).
                  </p>
                ) : null}

                {block.type === "image" ? (
                  <div className={styles.grid2}>
                    <label>
                      Image URL
                      <input
                        value={block.url}
                        onChange={(event) => updateBlock(block.id, { url: event.target.value })}
                      />
                    </label>
                    <label>
                      Alt text
                      <input
                        value={block.alt || ""}
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
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                      />
                    </label>
                    <label>
                      URL
                      <input
                        value={block.url}
                        onChange={(event) => updateBlock(block.id, { url: event.target.value })}
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
                        onChange={(event) => {
                          const product = productOptions.find((item) => item.id === event.target.value);
                          if (!product?.image_url) return;
                          updateBlock(block.id, {
                            product_id: product.id,
                            slug: product.slug,
                            title: product.title,
                            image_url: product.image_url,
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
                        onChange={(event) => updateBlock(block.id, { cta_label: event.target.value })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} disabled={busy !== null} onClick={() => void save()}>
              {busy === "save" || saveStatus === "saving" ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void refreshPreview()}>
              {busy === "preview" ? "Loading preview…" : "Refresh preview"}
            </button>
          </div>

          <div className={styles.sendPanel}>
            <h2>Send test</h2>
            <div className={styles.testRow}>
              <input
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button type="button" disabled={busy !== null} onClick={() => void sendTest()}>
                {busy === "test" ? "Sending test…" : "Send test"}
              </button>
            </div>
            <p className={styles.hint}>Preview and tests use sample order GEO-0042.</p>
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
