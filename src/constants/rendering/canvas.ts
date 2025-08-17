// Canvas setup with proper scaling
export const CVS = document.querySelector('canvas');
export const CTX = CVS?.getContext('2d');

// Safe accessor functions for canvas and context
export function getCVS(): HTMLCanvasElement | null {
  return CVS;
}

export function getCTX(): CanvasRenderingContext2D | null {
  return CTX || null;
}

export function requireCVS(): HTMLCanvasElement {
  if (!CVS) {
    throw new Error('Canvas not initialized');
  }
  return CVS;
}

export function requireCTX(): CanvasRenderingContext2D {
  if (!CTX) {
    throw new Error('Canvas context not initialized');
  }
  return CTX;
}

// Set the internal canvas resolution (this is what the game logic uses)
export const CANVAS_INTERNAL_WIDTH = 800;
export const CANVAS_INTERNAL_HEIGHT = 600;

// Initialize canvas with proper scaling
export function initializeCanvas(): void {
  if (CVS && CTX) {
    // Get the viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Set the internal resolution to match the viewport (what the game logic uses)
    CVS.width = viewportWidth;
    CVS.height = viewportHeight;

    // Enable crisp pixel rendering
    CTX.imageSmoothingEnabled = false;
    CTX.imageSmoothingQuality = 'high';

    // Add resize handler to maintain full-screen coverage
    window.addEventListener('resize', handleCanvasResize);

    // Initial resize call
    handleCanvasResize();
  }
}

// Handle canvas resizing to maintain full-screen coverage
function handleCanvasResize(): void {
  if (CVS && CTX) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Update internal resolution to match new viewport size
    CVS.width = viewportWidth;
    CVS.height = viewportHeight;

    // Re-enable crisp rendering after resize
    CTX.imageSmoothingEnabled = false;
    CTX.imageSmoothingQuality = 'high';
  }
}

// Coordinate scaling utilities for dynamic canvas sizes
export function getCanvasScaleX(): number {
  return CVS ? CVS.width / CANVAS_INTERNAL_WIDTH : 1;
}

export function getCanvasScaleY(): number {
  return CVS ? CVS.height / CANVAS_INTERNAL_HEIGHT : 1;
}

export function scaleX(x: number): number {
  return x * getCanvasScaleX();
}

export function scaleY(y: number): number {
  return y * getCanvasScaleY();
}

export function getCanvasCenter(): { x: number; y: number } {
  return {
    x: CVS ? CVS.width / 2 : 400,
    y: CVS ? CVS.height / 2 : 300,
  };
}
