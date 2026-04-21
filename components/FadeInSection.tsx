"use client";

import { HTMLAttributes, ReactNode, useEffect, useRef, useState } from "react";

type FadeInSectionProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export function FadeInSection({ children, className, ...rest }: FadeInSectionProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

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
