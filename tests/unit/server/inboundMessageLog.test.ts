import { expect, test } from 'vitest';
import { shouldLogInboundGameplayMessage } from '../../../server/communication/inboundMessageLog';

test('high-frequency gameplay frames are not inbound-logged', () => {
  expect(shouldLogInboundGameplayMessage('update')).toBe(false);
  expect(shouldLogInboundGameplayMessage('ping')).toBe(false);
  expect(shouldLogInboundGameplayMessage('pong')).toBe(false);
});

test('rare gameplay messages may still be inbound-logged', () => {
  expect(shouldLogInboundGameplayMessage('join')).toBe(true);
  expect(shouldLogInboundGameplayMessage('initAsteroids')).toBe(true);
  expect(shouldLogInboundGameplayMessage('shoot')).toBe(true);
});
