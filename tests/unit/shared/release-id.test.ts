import { expect, test } from 'vitest';
import { DEV_RELEASE_ID, readReleaseId, releaseField } from '../../../shared/releaseId';

test('readReleaseId lowercases Git SHAs and ignores malformed values', () => {
  expect(readReleaseId(DEV_RELEASE_ID)).toBe(DEV_RELEASE_ID);
  expect(readReleaseId('B'.repeat(40))).toBe('b'.repeat(40));
  for (const malformed of ['not-a-release', 'abc1234', '', undefined]) {
    expect(readReleaseId(malformed)).toBeUndefined();
  }
});

test('releaseField omits unknown values so optional object spreads stay exact', () => {
  expect(releaseField('scoreReleaseId', undefined)).toEqual({});
  expect(releaseField('scoreReleaseId', DEV_RELEASE_ID)).toEqual({
    scoreReleaseId: DEV_RELEASE_ID,
  });
});
