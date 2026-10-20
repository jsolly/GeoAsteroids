type ScanDeviceHints = Readonly<{
  userAgent: string;
  coarsePointer: boolean;
  deviceMemory: number | null;
  hardwareConcurrency: number | null;
}>;

type ScanDetail =
  | Readonly<{ mode: 'full'; reason: 'default-full' | 'forced-full' }>
  | Readonly<{
      mode: 'simple';
      reason: 'known-fire-model' | 'low-capacity-coarse-pointer' | 'forced-simple';
    }>;

const measuredFireModel = /\bKFTUWI\b/iu;

export function classifyScanDevice(
  hints: ScanDeviceHints
): 'low-end' | 'commodity' | 'high-end' | 'unknown' {
  if (measuredFireModel.test(hints.userAgent)) {
    return 'low-end';
  }
  const { deviceMemory, hardwareConcurrency } = hints;
  if (
    deviceMemory === null ||
    !Number.isFinite(deviceMemory) ||
    deviceMemory <= 0 ||
    hardwareConcurrency === null ||
    !Number.isInteger(hardwareConcurrency) ||
    hardwareConcurrency <= 0
  ) {
    return 'unknown';
  }
  if (hints.coarsePointer && deviceMemory <= 4 && hardwareConcurrency <= 4) {
    return 'low-end';
  }
  if (deviceMemory >= 8 && hardwareConcurrency >= 8) {
    return 'high-end';
  }
  return 'commodity';
}

/** Resolve once per session from supplied browser hints, outside the drawing loop. */
export function resolveScanDetail(search: string, hints: ScanDeviceHints): ScanDetail {
  const params = new URLSearchParams(search);
  const diagnostic = ['1', 'collect'].includes(params.get('performance') ?? '');
  const requested = diagnostic ? params.get('scanDetail') : null;
  switch (requested) {
    case 'full':
      return { mode: 'full', reason: 'forced-full' };
    case 'simple':
      return { mode: 'simple', reason: 'forced-simple' };
    case null:
    case 'auto':
      break;
    default:
      throw new Error('scanDetail must be auto, full, or simple');
  }

  if (classifyScanDevice(hints) === 'low-end') {
    return {
      mode: 'simple',
      reason: measuredFireModel.test(hints.userAgent)
        ? 'known-fire-model'
        : 'low-capacity-coarse-pointer',
    };
  }
  return { mode: 'full', reason: 'default-full' };
}
