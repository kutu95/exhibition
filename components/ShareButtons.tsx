"use client";

import { useRef, useState } from "react";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";
import styles from "./ShareButtons.module.css";

type ShareButtonsProps = {
  url: string;
  title: string;
  description?: string;
};

const openPopup = (popupUrl: string) => {
  window.open(popupUrl, "share-window", "width=600,height=400");
};

export function ShareButtons({ url, title, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const shareText = description ? `${title} — ${description}` : title;

  const handleFacebook = () => {
    trackEvent(PlausibleEvents.SHARE_CLICK, {
      method: "facebook",
      page: url,
    });
    openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
  };

  const handleX = () => {
    trackEvent(PlausibleEvents.SHARE_CLICK, {
      method: "twitter",
      page: url,
    });
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    openPopup(tweetUrl);
  };

  const handleCopy = async () => {
    trackEvent(PlausibleEvents.SHARE_CLICK, {
      method: "copy_link",
      page: url,
    });
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (fallbackInputRef.current) {
        fallbackInputRef.current.value = url;
        fallbackInputRef.current.focus();
        fallbackInputRef.current.select();
        document.execCommand("copy");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={styles.row}>
      <button className={styles.button} type="button" onClick={handleFacebook}>
        Share on Facebook
      </button>
      <button className={styles.button} type="button" onClick={handleCopy}>
        {copied ? "Copied" : "Copy link"}
      </button>
      <button className={styles.button} type="button" onClick={handleX}>
        Share on X
      </button>
      <input ref={fallbackInputRef} className={styles.hiddenInput} readOnly aria-hidden tabIndex={-1} />
    </div>
  );
}
