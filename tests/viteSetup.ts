import jsdom from 'jsdom';

const { JSDOM } = jsdom;
import '../src/utils/logLevel';

const dom = new JSDOM(
  `<!DOCTYPE html>
<html lang="en">
  <body>
    <div id="gameWrapper">
      <div id="start-screen" class="screen">
        <h1 class="text-center">GeoRoids</h1>
        <div class="game-modes">
          <div class="mb-3">
            <label for="playerNameInput" class="form-label">Your Nickname</label>
            <input
              type="text"
              id="playerNameInput"
              maxlength="20"
              placeholder="Crimson Falcon"
              class="form-control"
            />
          </div>
          <ul class="nav flex-column">
            <li class="nav-item">
              <button id="start-game" class="btn btn-lg btn-success">
                Enter Game
              </button>
            </li>
          </ul>
        </div>
        <div class="settings">
          <ul class="nav flex-column">
            <li class="nav-item">
              <input
                class="form-check-input"
                type="checkbox"
                value=""
                id="soundPref"
                checked
              />
              <label class="form-check-label" for="soundPref">Sound</label>
            </li>
          </ul>
        </div>
      </div>
      <div id="gameArea" style="display: none">
        <canvas id="gameCanvas" width="800" height="600"></canvas>
      </div>
    </div>
    <div id="attribution">
      <a
        href="https://www.freepik.com/free-photo/starry-night-sky_7061153.htm#query=space&position=11&from_view=search"
        >Image by kjpargeter on Freepik</a
      >
    </div>
  </body>
</html>`
);
global.document = dom.window.document;
global.window = global.document.defaultView as unknown as Window & typeof globalThis;

// Mock localStorage for tests with the same backing store for global/window access.
const storage = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return storage.size;
  },
  clear() {
    storage.clear();
  },
  getItem(key: string) {
    return storage.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(storage.keys())[index] ?? null;
  },
  removeItem(key: string) {
    storage.delete(key);
  },
  setItem(key: string, value: string) {
    storage.set(key, value);
  },
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
  writable: true,
});

// Silence jsdom "Not implemented: HTMLMediaElement.prototype.play" by stubbing media methods
type MediaProto = {
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
};

const maybePatchMediaProto = (proto: unknown) => {
  if (!proto || typeof proto !== 'object') {
    return;
  }
  const p = proto as MediaProto;
  Object.defineProperty(p, 'play', {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(p, 'pause', {
    configurable: true,
    writable: true,
    value: () => {},
  });
  Object.defineProperty(p, 'load', {
    configurable: true,
    writable: true,
    value: () => {},
  });
};

maybePatchMediaProto(
  (globalThis as unknown as { HTMLMediaElement?: { prototype?: unknown } }).HTMLMediaElement
    ?.prototype
);
maybePatchMediaProto(
  (global.window as unknown as { HTMLMediaElement?: { prototype?: unknown } }).HTMLMediaElement
    ?.prototype
);
maybePatchMediaProto(
  (globalThis as unknown as { HTMLAudioElement?: { prototype?: unknown } }).HTMLAudioElement
    ?.prototype
);
maybePatchMediaProto(
  (global.window as unknown as { HTMLAudioElement?: { prototype?: unknown } }).HTMLAudioElement
    ?.prototype
);

// Mock Audio for tests
if (typeof global.window.Audio === 'undefined') {
  global.window.Audio = class {
    constructor(src?: string) {
      if (src) {
        this.src = src;
      }
    }
    src: string = '';
    play(): Promise<void> {
      return Promise.resolve();
    }
    pause(): void {}
    load(): void {}
    addEventListener(): void {}
    removeEventListener(): void {}
    volume: number = 1;
    currentTime: number = 0;
    duration: number = 0;
    paused: boolean = true;
  } as unknown as typeof HTMLAudioElement;
}
