import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

test('a flight that is already running stays unlabeled until an equippable pickup', async () => {
  vi.resetModules();
  const { setPlayView } = await import('../../../src/ui/uiUtils');
  setPlayView(true);
  const { initializeSchematicEquipHint, schematicEquipHintAlpha, showSchematicEquipHint } =
    await import('../../../src/ui/schematicEquipHint');
  initializeSchematicEquipHint();
  expect(schematicEquipHintAlpha(1_000)).toBe(0);
  showSchematicEquipHint();
  expect(schematicEquipHintAlpha(1_000)).toBe(1);
});
