/**
 * hui-card uses light DOM and defaults to inline. WebKit can retain an anonymous
 * block's intrinsic height inside an auto Sections row after sibling updates.
 * Normalize only automatic rows. A fixed Sections row needs the native inline
 * wrapper so percentage-height cards resolve against the reserved grid cell.
 */
export function normalizeCardLayoutWrapper(host: HTMLElement): () => void {
  const wrapper = host.parentElement;
  if (wrapper?.localName !== "hui-card" || wrapper.style.display || getComputedStyle(wrapper).display !== "inline") {
    return () => {};
  }
  const cell = wrapper.parentElement;
  let ownsDisplay = false;
  const sync = () => {
    // An explicit layout/visibility change made by HA or another card takes ownership.
    if (ownsDisplay && wrapper.style.display !== "block") ownsDisplay = false;
    if (cell?.matches(".card.fit-rows")) {
      if (ownsDisplay) wrapper.style.removeProperty("display");
      ownsDisplay = false;
    } else if (!wrapper.style.display && getComputedStyle(wrapper).display === "inline") {
      wrapper.style.display = "block";
      ownsDisplay = true;
    }
  };
  sync();
  // HA can edit row sizing on the existing cell without reconnecting the host.
  const observer = cell ? new MutationObserver(sync) : null;
  if (observer && cell) observer.observe(cell, { attributes: true, attributeFilter: ["class"] });
  return () => {
    observer?.disconnect();
    if (ownsDisplay && wrapper.style.display === "block") wrapper.style.removeProperty("display");
  };
}

const SECTIONS_CARD_OWNERS = new Set(["hui-section", "hui-grid-section"]);

function isHostedBySections(host: HTMLElement): boolean {
  let node: Node | null = host.parentNode;
  while (node) {
    if (node instanceof ShadowRoot) {
      node = node.host;
      continue;
    }
    if (node instanceof Element && SECTIONS_CARD_OWNERS.has(node.localName)) return true;
    node = node.parentNode;
  }
  return false;
}

/**
 * `card-updated` makes HA replace the owning view's card list. Sections keeps keyed
 * card nodes and only re-measures the row. Masonry, Sidebar and Panel views rebuild
 * their columns and re-append every card, which reconnects this host and would report
 * again: a continuous whole-view relayout (#321). Those layouts size cards by normal
 * flow and need no notification.
 */
export function notifyCardLayoutChange(host: HTMLElement): void {
  host.dispatchEvent(new CustomEvent("iron-resize", {bubbles: true, composed: true}));
  if (isHostedBySections(host)) {
    host.dispatchEvent(new CustomEvent("card-updated", {bubbles: true, composed: true}));
  }
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
          notifyCardLayoutChange(host);
        });
      }, 80);
    },
    cancel,
  };
}
