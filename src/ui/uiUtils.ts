let playView = false;

export function isPlayViewOn(): boolean {
  return playView;
}
export function resetPlayView(): void {
  playView = false;
}

/** Publish the new state before notifying the shell and other synchronous readers. */
export function setPlayView(inPlay: boolean): void {
  playView = inPlay;
  window.dispatchEvent(new CustomEvent(inPlay ? 'playViewOn' : 'playViewOff'));
}
