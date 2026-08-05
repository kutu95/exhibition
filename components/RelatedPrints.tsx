"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { RelatedPrint } from "../lib/related-prints";
import styles from "./RelatedPrints.module.css";

type RelatedPrintsProps = {
  title: string;
  related: RelatedPrint[];
};

export function RelatedPrints({ title, related }: RelatedPrintsProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollState = () => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollPrev(track.scrollLeft > 4);
    setCanScrollNext(track.scrollLeft < maxScroll - 4);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateScrollState();
    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [related]);

  if (related.length === 0) return null;

  const scrollBySlide = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>(`.${styles.slide}`);
    const delta = (slide?.offsetWidth ?? track.clientWidth * 0.8) + 16;
    track.scrollBy({ left: direction * delta, behavior: "smooth" });
  };

  const showControls = related.length > 1;

  return (
    <nav className={`container ${styles.wrap}`} aria-label={`Photographs related to ${title}`}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Related photographs</h2>
        {showControls ? (
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.control}
              onClick={() => scrollBySlide(-1)}
              disabled={!canScrollPrev}
              aria-label="Previous related photograph"
            >
              ←
            </button>
            <button
              type="button"
              className={styles.control}
              onClick={() => scrollBySlide(1)}
              disabled={!canScrollNext}
              aria-label="Next related photograph"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <ul ref={trackRef} className={styles.track}>
        {related.map((print) => (
          <li key={print.slug} className={styles.slide}>
            <Link href={`/shop/${print.slug}`} className={styles.link}>
              {print.imageUrl ? (
                <span className={styles.thumb}>
                  <Image src={print.imageUrl} alt="" fill sizes="320px" className={styles.image} />
                </span>
              ) : null}
              <span className={styles.title}>{print.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
