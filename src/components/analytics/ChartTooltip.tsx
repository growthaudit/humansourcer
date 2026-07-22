import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface TooltipState {
  x: number;
  y: number;
  content: ComponentChildren;
}

// Shared hover-tooltip mechanism for the SVG/HTML charts in this folder.
// Positions off the hovered element's own getBoundingClientRect() rather
// than SVG viewBox math, so it works the same regardless of how much the
// chart is scaled by its container.
export function useChartTooltip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = (e: MouseEvent, content: ComponentChildren) => {
    const el = e.currentTarget as Element;
    const container = containerRef.current;
    if (!container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setTooltip({
      x: elRect.left + elRect.width / 2 - containerRect.left,
      y: elRect.top - containerRect.top,
      content,
    });
  };

  const hideTooltip = () => setTooltip(null);

  return { containerRef, tooltip, showTooltip, hideTooltip };
}

// Live pixel width of a container, via ResizeObserver — lets a chart branch
// its label strategy (full → truncated → rotated) off the actual rendered
// width instead of the fixed SVG viewBox, which just scales everything
// (including text) uniformly and never actually prevents overlap.
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border border-border-strong bg-surface-raised px-2 py-1.5 text-xs text-ink-primary shadow-card"
      style={{ left: `${tooltip.x}px`, top: `${tooltip.y - 8}px` }}
    >
      {tooltip.content}
    </div>
  );
}
