/** Railway injects the deployed Git revision; local runs have no release identity. */
import process from 'node:process';
import { DEV_RELEASE_ID, readReleaseId } from '../shared/releaseId';

export const SERVER_RELEASE_ID =
  readReleaseId(process.env['RAILWAY_GIT_COMMIT_SHA']) ?? DEV_RELEASE_ID;
