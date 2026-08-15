"use client";

import { useRef } from "react";

import { looksLikeLinkTarget, wrapTextWithLink } from "../../lib/campaigns/inline-links";
import styles from "./CampaignEditorClient.module.css";

type ParagraphTextFieldProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function ParagraphTextField({ value, disabled, onChange }: ParagraphTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const selected = value.slice(textarea.selectionStart, textarea.selectionEnd);
    const defaultUrl = looksLikeLinkTarget(selected) ? selected.trim() : "https://";
    const url = window.prompt("Link address", defaultUrl);
    if (url === null) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    let label: string | undefined;
    if (!selected.trim() || looksLikeLinkTarget(selected)) {
      const typed = window.prompt(
        "Link text",
        looksLikeLinkTarget(selected) ? "read more" : "link text",
      );
      if (typed === null) return;
      label = typed.trim() || "link text";
    }

    const next = wrapTextWithLink(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      trimmedUrl,
      label,
    );
    onChange(next.text);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.cursor, next.cursor);
    });
  };

  return (
    <div className={styles.paragraphField}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={styles.paragraphTools}>
        <button type="button" disabled={disabled} onClick={insertLink}>
          Insert link
        </button>
        <p className={styles.hint}>
          Select words first, then Insert link. You can also type [Shop](/shop) or paste an HTML
          {" "}
          &lt;a href&gt; tag.
        </p>
      </div>
    </div>
  );
}
