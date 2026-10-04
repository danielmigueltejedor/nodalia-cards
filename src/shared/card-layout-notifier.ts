/**
 * hui-card uses light DOM and defaults to inline. WebKit can retain an anonymous
 * block's intrinsic height inside an auto Sections row after sibling updates.
 * Normalize only automatic rows. A fixed Sections row needs the native inline
 * wrapper so percentage-height cards resolve against the reserved grid cell.
 */
export function normalizeCardLayoutWrapper(host: HTMLElement): () => void {
  const wrapper = host.parentElement;
  if (wrapper?.localName !== "hui-card" || wrapper.parentElement?.matches(".card.fit-rows") || wrapper.style.display || getComputedStyle(wrapper).display !== "inline") {
    return () => {};
  }
  wrapper.style.display = "block";
  return () => {
    if (wrapper.style.display === "block") wrapper.style.removeProperty("display");
  };
}

/** Report settled size changes without rebuilding the card or resizing the whole window. */
export function createCardLayoutNotifier(host: HTMLElement) {
  let timer = 0;
  let frame = 0;
  let width = 0;
  let height = 0;
  let reportedWidth = 0;
  let reportedHeight = 0;
  let generation = 0;
  const cancel = () => {
    ++generation;
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
    timer = frame = 0;
    width = height = reportedWidth = reportedHeight = 0;
  };
  return {
    observe(entry: ResizeObserverEntry | undefined) {
      if (!entry || !host.isConnected) return;
      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);
      // Hidden cards must not replace their last visible footprint with zero.
      if (nextWidth < 48 || nextHeight < 1) return;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      frame = 0;
      const current = ++generation;
      // Wait for animation/HA feedback to settle, then let layout complete first.
      timer = window.setTimeout(() => {
        timer = 0;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          if (!host.isConnected || current !== generation) return;
          if (width === reportedWidth && height === reportedHeight) return;
          reportedWidth = width;
          reportedHeight = height;
          host.dispatchEvent(new CustomEvent("iron-resize", {bubbles: true, composed: true}));
          host.dispatchEvent(new CustomEvent("card-updated", {bubbles: true, composed: true}));
        });
      }, 80);
    },
    cancel,
  };
}
