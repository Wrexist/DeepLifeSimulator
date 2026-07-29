/**
 * The photo portrait, from decoded pixels to a storable URI — and the wiring
 * that carries it to the save.
 *
 * ## Why the wiring is asserted at all
 *
 * Because the thing this replaces was code that existed, was reviewed, was unit
 * tested, and never ran. `FaceCanvas.capture()` asked `GLView.takeSnapshotAsync`
 * for a PNG, got a `file://` URI — which is all that function has ever returned,
 * on either platform, in any format — checked `startsWith('data:image')`, and
 * returned null. Every device, every time. The pixels were fine; nothing
 * connected them to the save.
 *
 * So the pipeline is tested here with the GPU stubbed out, and the connections
 * are asserted separately, because a perfect cut-out that no screen calls is the
 * same defect wearing different clothes.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('@/services/avatar/glPixels', () => ({
  canReadPixels: jest.fn(() => true),
  readPhotoPixels: jest.fn(),
  readPhotoAtLongEdge: jest.fn(),
}));

import { buildPhotoPortrait, isPhotoPortraitSupported } from '@/services/avatar/photoPortrait';
import { readPhotoAtLongEdge, canReadPixels } from '@/services/avatar/glPixels';
import { MAX_PORTRAIT_BYTES } from '@/lib/identity';
import type { PhotoInput } from '@/services/avatar/types';

const decode = readPhotoAtLongEdge as jest.MockedFunction<typeof readPhotoAtLongEdge>;
const available = canReadPixels as jest.MockedFunction<typeof canReadPixels>;

const PHOTO: PhotoInput = { uri: 'file:///tmp/selfie.jpg', width: 1200, height: 1600 };

/** A face on a sky, big enough for the matte and the anchors to find it. */
function portraitPixels(w = 384, h = 512): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  const put = (x: number, y: number, c: [number, number, number]): void => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  };
  const cx = w / 2;
  const cy = h * 0.42;
  const faceR = w * 0.19;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, [88, 150, 220]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (faceR * 1.34);
      const dy = (y - (cy - faceR * 0.12)) / (faceR * 1.5);
      if (dx * dx + dy * dy <= 1) put(x, y, [46, 32, 28]);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / faceR;
      const dy = (y - cy) / (faceR * 1.28);
      if (dx * dx + dy * dy <= 1) put(x, y, [214, 168, 140]);
    }
  }
  const eyeY = cy - faceR * 0.22;
  for (const side of [-1, 1]) {
    const ex = cx + side * faceR * 0.42;
    for (let yy = -5; yy <= 5; yy++) {
      for (let xx = -7; xx <= 7; xx++) {
        if (xx * xx / 49 + yy * yy / 25 <= 1) put(ex + xx, eyeY + yy, [30, 28, 32]);
      }
    }
    for (let xx = -10; xx <= 10; xx++) for (let yy = 0; yy < 4; yy++) put(ex + xx, eyeY - 16 + yy, [48, 34, 26]);
  }
  for (let yy = -5; yy <= 5; yy++) {
    for (let xx = -20; xx <= 20; xx++) {
      if (Math.abs(yy) <= 5 * (1 - (xx / 20) ** 2)) put(cx + xx, cy + faceR * 0.55 + yy, [196, 92, 96]);
    }
  }
  return px;
}

beforeEach(() => {
  jest.clearAllMocks();
  available.mockReturnValue(true);
});

describe('buildPhotoPortrait', () => {
  it('turns a photo into a storable PNG data URI', async () => {
    decode.mockResolvedValue({ pixels: portraitPixels(), width: 384, height: 512 });
    const uri = await buildPhotoPortrait(PHOTO);
    expect(uri).not.toBeNull();
    expect(uri!.startsWith('data:image/png;base64,')).toBe(true);
    // The bound that matters: this string is copied into every save and every
    // backup, and one that will not fit makes the save unwritable forever.
    expect(uri!.length).toBeLessThanOrEqual(MAX_PORTRAIT_BYTES);
  }, 30000);

  it('decodes at the photo’s own aspect ratio, not as a square', async () => {
    // A 3:4 photo squashed into a square is a distorted head, and the cut-out
    // then frames the distortion.
    decode.mockResolvedValue({ pixels: portraitPixels(), width: 384, height: 512 });
    await buildPhotoPortrait(PHOTO);
    expect(decode).toHaveBeenCalledWith(PHOTO.uri, 1200, 1600, expect.any(Number));
  }, 30000);

  it('produces a portrait with real transparency, not an opaque square', async () => {
    // The entire promise of the feature. An encoder or a matte that lost alpha
    // would still return a valid PNG of the right size.
    decode.mockResolvedValue({ pixels: portraitPixels(), width: 384, height: 512 });
    const uri = (await buildPhotoPortrait(PHOTO))!;
    const png = Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64');
    // Colour type 6 — truecolour WITH alpha — is byte 25 of a PNG's IHDR.
    expect(png[25]).toBe(6);
  }, 30000);

  it('returns null when nothing can be separated from the background', async () => {
    // Null means "keep the starter portrait", which always renders. Taking a
    // player's existing portrait away on a failed scan is worse than doing
    // nothing at all.
    decode.mockResolvedValue({ pixels: new Uint8Array(384 * 512 * 4).fill(120), width: 384, height: 512 });
    await expect(buildPhotoPortrait(PHOTO)).resolves.toBeNull();
  }, 30000);

  it('returns null rather than throwing when the photo cannot be decoded', async () => {
    decode.mockRejectedValue(new Error('expo-gl unavailable'));
    await expect(buildPhotoPortrait(PHOTO)).resolves.toBeNull();
  });

  it('stops when the caller aborts', async () => {
    decode.mockResolvedValue({ pixels: portraitPixels(), width: 384, height: 512 });
    const controller = new AbortController();
    controller.abort();
    await expect(buildPhotoPortrait(PHOTO, { signal: controller.signal })).resolves.toBeNull();
  }, 30000);

  it('reports support from the decoder rather than assuming it', async () => {
    available.mockReturnValue(false);
    expect(isPhotoPortraitSupported()).toBe(false);
    available.mockReturnValue(true);
    expect(isPhotoPortraitSupported()).toBe(true);
  });
});

describe('the portrait actually reaches the save', () => {
  const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');

  it('SelfieFlow builds one and hands it to onKeep', () => {
    const src = read('components/identity/SelfieFlow.tsx');
    expect(src).toMatch(/buildPhotoPortrait\(photo, \{ signal/);
    expect(src).toMatch(/onKeep\(genome, portraitUri\)/);
  });

  it('FaceCreatorModal prefers it over a render of the 3D head', () => {
    // Anchored on the PRECEDENCE, not merely on the field existing. The selfie
    // route lands in the studio, so `handleDone` runs afterwards either way —
    // if the canvas snapshot won, a player who chose a photo would be given a
    // picture of a model instead.
    const src = read('components/identity/FaceCreatorModal.tsx');
    expect(src).toMatch(/photoPortraitRef\.current = portraitUri/);
    expect(src).toMatch(/let uri: string \| null = photoPortraitRef\.current/);
    expect(src).toMatch(/if \(!uri\) uri = \(await canvasRef\.current\?\.capture\(\)\)/);
  });

  it('FaceCanvas encodes its own pixels instead of asking for a file', () => {
    // The regression guard for the bug at the top of this file: any return to
    // `takeSnapshotAsync` silently disables the studio portrait on every device.
    const src = read('components/identity/FaceCanvas.tsx');
    expect(src).toMatch(/encodePngDataUri\(/);
    expect(src).toMatch(/gl\.readPixels\(/);
    // Mentioned only in the comment explaining why it is not used.
    expect(src).not.toMatch(/GLView\.takeSnapshotAsync\(/);
  });
});
