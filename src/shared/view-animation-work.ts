/** Owned animation work for one card instance; no callbacks outlive its view. */
export interface ViewAnimationWork {
  generation: number;
  timers: Set<number>;
  cancels: Set<() => void>;
}

export function createViewAnimationWork(): ViewAnimationWork {
  return { generation: 0, timers: new Set(), cancels: new Set() };
}

export function scheduleViewFallback(work: ViewAnimationWork, callback: () => void, delay: number): number {
  const timer = window.setTimeout(() => { work.timers.delete(timer); callback(); }, delay);
  work.timers.add(timer);
  return timer;
}

export function cancelViewPanelAnimations(work: ViewAnimationWork): void {
  ++work.generation;
  work.cancels.forEach(cancel => cancel());
  work.cancels.clear();
}

export function releaseViewAnimationWork(work: ViewAnimationWork): void {
  cancelViewPanelAnimations(work);
  work.timers.forEach(timer => window.clearTimeout(timer));
  work.timers.clear();
}

/** Finite, synchronized state feedback; HA state and hit targets update first. */
export function animateViewState(work: ViewAnimationWork, elements: readonly Element[], duration = 220): void {
  cancelViewPanelAnimations(work);
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  for (const element of elements) {
    const animation = element.animate([
      { opacity: 0.45, transform: "translateY(3px) scale(.96)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ], { duration, easing: "cubic-bezier(.22,.84,.26,1)" });
    const cancel = () => { animation.cancel(); work.cancels.delete(cancel); };
    work.cancels.add(cancel);
    void animation.finished.then(() => work.cancels.delete(cancel), () => work.cancels.delete(cancel));
  }
}

/** Complete once via the panel's own event or the deadline, and detach both. */
export function waitForViewPanelAnimation(work: ViewAnimationWork, panel: HTMLElement, callback: () => void, delay: number): void {
  let done = false;
  let timer = 0;
  const cancel = () => {
    done = true;
    panel.removeEventListener("animationend", onEnd);
    window.clearTimeout(timer);
    work.timers.delete(timer);
    work.cancels.delete(cancel);
  };
  const finish = () => { if (!done) { cancel(); callback(); } };
  const onEnd = (event: Event) => { if (event.target === panel) finish(); };
  panel.addEventListener("animationend", onEnd);
  timer = scheduleViewFallback(work, finish, delay);
  work.cancels.add(cancel);
}
