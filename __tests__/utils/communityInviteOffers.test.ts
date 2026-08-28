/**
 * The durable half of the invite-offer rule: reading the record, migrating the
 * legacy tombstone, and spending an offer.
 *
 * The migration is the part worth pinning. Every install that ever dismissed
 * the old popup has `discord_popup_seen = 'true'` on disk. Reading that as
 * "never ask again" would carry the exact defect this change removes forward
 * for every existing player - the new code would be correct and the old data
 * would keep enforcing the old behaviour.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  INVITE_OFFER_KEY,
  LEGACY_SEEN_KEY,
  readInviteOffers,
  recordInviteOffer,
} from '@/utils/communityInvitePrompt';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  };
  return { __esModule: true, default: mock, ...mock };
});

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

/** Answer per key, so the legacy fallback can be exercised independently. */
function storage(values: Record<string, string | null>) {
  mockGetItem.mockImplementation((key: string) => Promise.resolve(values[key] ?? null));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('readInviteOffers', () => {
  it('reads nothing spent on a fresh install', async () => {
    storage({});
    await expect(readInviteOffers()).resolves.toEqual({ count: 0 });
  });

  it('round-trips a stored record', async () => {
    storage({ [INVITE_OFFER_KEY]: JSON.stringify({ count: 2, lastWeek: 640 }) });
    await expect(readInviteOffers()).resolves.toEqual({ count: 2, lastWeek: 640 });
  });

  it('migrates the legacy tombstone to ONE spent offer, not a permanent block', async () => {
    storage({ [LEGACY_SEEN_KEY]: 'true' });
    await expect(readInviteOffers()).resolves.toEqual({ count: 1, lastWeek: undefined });
  });

  it('prefers the new record over the legacy key once one exists', async () => {
    storage({
      [INVITE_OFFER_KEY]: JSON.stringify({ count: 3, lastWeek: 700 }),
      [LEGACY_SEEN_KEY]: 'true',
    });
    await expect(readInviteOffers()).resolves.toEqual({ count: 3, lastWeek: 700 });
  });

  describe('degrades to "nothing spent" rather than throwing', () => {
    // This runs inside home's mount effect; a throw there is a broken screen.
    it.each([
      ['malformed JSON', '{not json'],
      ['a JSON scalar', '42'],
      ['an object with no count', JSON.stringify({ lastWeek: 12 })],
      ['a negative count', JSON.stringify({ count: -1 })],
    ])('%s', async (_label, raw) => {
      storage({ [INVITE_OFFER_KEY]: raw });
      await expect(readInviteOffers()).resolves.toEqual({ count: 0 });
    });
  });

  it('degrades when storage itself rejects', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'));
    await expect(readInviteOffers()).resolves.toEqual({ count: 0 });
  });
});

describe('recordInviteOffer', () => {
  it('increments the record it was given and stamps the week', async () => {
    await recordInviteOffer(812, { count: 1, lastWeek: 700 });
    expect(mockSetItem).toHaveBeenCalledWith(
      INVITE_OFFER_KEY,
      JSON.stringify({ count: 2, lastWeek: 812 })
    );
  });

  it('omits a non-finite week rather than storing NaN', async () => {
    // A NaN lastWeek would make every later comparison false, silently
    // permanent - the failure mode this whole change exists to remove.
    await recordInviteOffer(Number.NaN, { count: 0 });
    expect(mockSetItem).toHaveBeenCalledWith(INVITE_OFFER_KEY, JSON.stringify({ count: 1 }));
  });

  it('reports failure instead of throwing when the write rejects', async () => {
    mockSetItem.mockRejectedValue(new Error('disk full'));
    await expect(recordInviteOffer(500, { count: 0 })).resolves.toBe(false);
  });
});
