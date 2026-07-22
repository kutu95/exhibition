"use client";

import { HTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";

type FadeInSectionProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Fade-in on scroll. SSR and no-JS: content stays visible (opacity 1).
 * Only elements that start below the fold are hidden then animated in.
 */
export function FadeInSection({ children, className, ...rest }: FadeInSectionProps) {
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const initiallyInView = node.getBoundingClientRect().top < window.innerHeight * 0.9;
    if (initiallyInView) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-in-section ${visible ? "visible" : ""} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
