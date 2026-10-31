"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (neutralised under reduced-motion via CSS). */
  delay?: number;
  /** Element to render (keeps lists and articles semantic). */
  as?: ElementType;
}

/**
 * Subtle fade-up on first scroll into view. A single shared
 * IntersectionObserver drives every instance. Users with
 * prefers-reduced-motion (and browsers with scripting disabled) see fully
 * revealed content — handled in CSS, so visibility never depends on this JS.
 */
let observer: IntersectionObserver | null = null;

function getObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
  }
  return observer;
}

export function Reveal({ children, className, delay = 0, as }: RevealProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const Tag = (as ?? "div") as ElementType;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obs = getObserver();
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        elRef.current = node;
      }}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
