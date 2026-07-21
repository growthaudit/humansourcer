import { useRef, useState } from 'preact/hooks';
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
