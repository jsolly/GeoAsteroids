import { expect, test } from 'vitest';
import { LogLevel, shouldEmitLog } from '../../../src/utils/logLevel';

test('an info threshold emits error/warn/info and suppresses debug', () => {
  expect(shouldEmitLog(LogLevel.ERROR, LogLevel.INFO)).toBe(true);
  expect(shouldEmitLog(LogLevel.WARN, LogLevel.INFO)).toBe(true);
  expect(shouldEmitLog(LogLevel.INFO, LogLevel.INFO)).toBe(true);
  expect(shouldEmitLog(LogLevel.DEBUG, LogLevel.INFO)).toBe(false);
});

test('a debug threshold emits every level', () => {
  expect(shouldEmitLog(LogLevel.ERROR, LogLevel.DEBUG)).toBe(true);
  expect(shouldEmitLog(LogLevel.DEBUG, LogLevel.DEBUG)).toBe(true);
});

test('an error threshold emits only errors', () => {
  expect(shouldEmitLog(LogLevel.ERROR, LogLevel.ERROR)).toBe(true);
  expect(shouldEmitLog(LogLevel.WARN, LogLevel.ERROR)).toBe(false);
  expect(shouldEmitLog(LogLevel.DEBUG, LogLevel.ERROR)).toBe(false);
});
