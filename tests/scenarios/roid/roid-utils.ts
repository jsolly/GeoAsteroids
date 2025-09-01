import { vi } from 'vitest';

// Mock the audio system for roid-related tests
vi.mock('../../../src/audio/Sound.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../../src/audio/Sound.ts');
  return {
    ...actual,
    playSound: vi.fn(),
  };
});
