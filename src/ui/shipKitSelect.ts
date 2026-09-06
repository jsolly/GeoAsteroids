import {
  DEFAULT_SHIP_KIT_ID,
  listShipKits,
  parseShipKitId,
  type ShipKitId,
} from '../entities/ship/shipKits';
import { attachEventListener, getElementById } from '../utils/dom';

let selectedKitId: ShipKitId = DEFAULT_SHIP_KIT_ID;

export function getSelectedShipKitId(): ShipKitId {
  return selectedKitId;
}

export function setSelectedShipKitId(kitId: unknown): ShipKitId {
  selectedKitId = parseShipKitId(kitId);
  syncKitButtons();
  return selectedKitId;
}

function syncKitButtons(): void {
  const grid = document.getElementById('ship-kit-grid');
  if (!grid) {
    return;
  }
  const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-kit-id]'));
  for (const button of buttons) {
    const isSelected = button.dataset.kitId === selectedKitId;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

export function mountShipKitSelect(): void {
  const grid = getElementById<HTMLElement>('ship-kit-grid');
  if (!grid) {
    return;
  }

  grid.replaceChildren();
  for (const kit of listShipKits()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ship-kit-card';
    button.dataset.kitId = kit.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="ship-kit-name">${kit.name}</span><span class="ship-kit-ability">${kit.abilityName}</span>`;
    attachEventListener(button, 'click', () => {
      setSelectedShipKitId(kit.id);
    });
    grid.appendChild(button);
  }
  syncKitButtons();
}
