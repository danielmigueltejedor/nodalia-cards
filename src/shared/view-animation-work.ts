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
