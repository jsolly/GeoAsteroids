/** Focus may return only to a connected, visible, enabled element. */
function isUsableFocusTarget(target: HTMLElement | null | undefined): target is HTMLElement {
  if (
    !target?.isConnected ||
    target === document.body ||
    target.matches(':disabled, [aria-disabled="true"]')
  ) {
    return false;
  }
  for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    if (
      ancestor.hidden ||
      ancestor.hasAttribute('inert') ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    ) {
      return false;
    }
  }
  return true;
}

export function isExternalFocusTarget(
  target: HTMLElement | null | undefined
): target is HTMLElement {
  return isUsableFocusTarget(target) && !target.closest('[role="dialog"], dialog');
}

export function focusReturnTarget(
  explicit: HTMLElement | null | undefined,
  opener: HTMLElement | null,
  fallback: HTMLElement | null | undefined
): HTMLElement | null {
  const target = isUsableFocusTarget(explicit)
    ? explicit
    : isExternalFocusTarget(opener)
      ? opener
      : fallback;
  return isUsableFocusTarget(target) ? target : null;
}
