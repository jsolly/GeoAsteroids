import { getElementById } from '../utils/dom.ts';

export function toggleScreen(id: string, toggle: boolean): void {
  const element = getElementById<HTMLElement>(id);
  if (element) {
    element.style.display = toggle ? 'block' : 'none';
  }
}
