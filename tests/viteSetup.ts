import jsdom from 'jsdom';

const { JSDOM } = jsdom;
import '../src/utils/logLevel';

const dom = new JSDOM(
  `<!DOCTYPE html>
<html lang="en">
  <body>
    <canvas id="title-starfield"></canvas>
    <div id="gameWrapper">
      <div id="start-screen" class="screen">
        <h1 class="text-center fs-1">GeoRoids</h1>
        <p id="controls-hint" class="controls-hint">WASD + Space / arrows · E ability</p>
        <fieldset class="ship-kit-select">
          <legend>Ship kit</legend>
          <div id="ship-kit-grid" class="ship-kit-grid" role="group" aria-label="Ship kit"></div>
          <p class="ship-kit-placeholder-note">AD v2 silhouettes</p>
        </fieldset>
        <ul class="nav flex-column">
          <li class="nav-item">
            
          </li>
          <li class="nav-item">
                    <button id="start-game" class="btn btn-lg btn-info">
          Game 🌐
        </button>
          </li>
          <li class="nav-item">
            <input
              class="form-check-input"
              type="checkbox"
              value=""
              id="soundPref"
            />
            <label class="form-check-label" for="soundPref"> Sound </label>
          </li>

        </ul>
        <h2>Difficulty</h2>
        <div
          class="btn-group"
          role="group"
          aria-label="Basic radio toggle button group"
        >
          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="easy"
            autocomplete="off"
            checked
          />
          <label class="btn btn-outline-success" for="easy">Easy</label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="medium"
            autocomplete="off"
          />
          <label class="btn btn-outline-warning" for="medium">Medium</label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="hard"
            autocomplete="off"
          />
          <label class="btn btn-outline-danger" for="hard">Hard</label>
        </div>
      </div>
      <div id="gameArea" style="display: none">
        <canvas id="gameCanvas" width="800" height="600"></canvas>

      </div>
    </div>
  </body>
  <div id="attribution">
    <span id="buildInfo" class="build-info"></span>
  </div>
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
