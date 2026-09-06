import { kitHullPickerSvg } from '../entities/ship/hullOutlines';
import {
  DEFAULT_SHIP_KIT_ID,
  listShipKits,
  parseShipKitId,
  type ShipKitId,
} from '../entities/ship/shipKits';
import { attachEventListener, getElementById } from '../utils/dom';

const SELECTED_KIT_STORAGE_KEY = 'georoids.selectedShipKit';

function readStoredKit(): ShipKitId {
  try {
    return parseShipKitId(globalThis.localStorage?.getItem(SELECTED_KIT_STORAGE_KEY));
  } catch {
    return DEFAULT_SHIP_KIT_ID;
  }
}

function persistSelectedKit(kitId: ShipKitId): void {
  try {
    globalThis.localStorage?.setItem(SELECTED_KIT_STORAGE_KEY, kitId);
  } catch {
    // Private mode / blocked storage — in-memory selection still applies on join.
  }
}

let selectedKitId: ShipKitId = readStoredKit();

export function getSelectedShipKitId(): ShipKitId {
  return selectedKitId;
}

export function setSelectedShipKitId(kitId: unknown): ShipKitId {
  selectedKitId = parseShipKitId(kitId);
  persistSelectedKit(selectedKitId);
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
    button.innerHTML = `${kitHullPickerSvg(kit.id)}<span class="ship-kit-name">${kit.name}</span><span class="ship-kit-ability">${kit.abilityName}</span>`;
    attachEventListener(button, 'click', () => {
      setSelectedShipKitId(kit.id);
    });
    grid.appendChild(button);
  }
  syncKitButtons();
}
