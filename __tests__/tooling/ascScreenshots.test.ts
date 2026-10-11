/**
 * The screenshot uploader validates a folder before it touches App Store
 * Connect: Apple's exact pixel sizes per display type, at most ten per set, and
 * name order as upload order.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import zlib from 'zlib';

const SCRIPT = pathToFileURL(join(__dirname, '..', '..', 'scripts', 'asc-screenshots.mjs')).href;

/** A minimal valid PNG of the given size (one black row repeated). */
function png(w: number, h: number): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) >>> 0 : 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function collect(dir: string, device: string): { name: string }[] | { error: string } {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { collectSet } from ${JSON.stringify(SCRIPT)};`
    + ` try { process.stdout.write(JSON.stringify(collectSet(${JSON.stringify(dir)}, ${JSON.stringify(device)}))); }`
    + ` catch (e) { process.stdout.write(JSON.stringify({ error: e.message })); }`], { encoding: 'utf8' });
  return JSON.parse(out);
}

describe('asc-screenshots collectSet', () => {
  it('accepts the exact Apple size and keeps name order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'asc-'));
    mkdirSync(join(dir, 'iphone-6.5'));
    writeFileSync(join(dir, 'iphone-6.5', '02-b.png'), png(1284, 2778));
    writeFileSync(join(dir, 'iphone-6.5', '01-a.png'), png(1284, 2778));
    const r = collect(dir, 'iphone-6.5') as { name: string }[];
    expect(r.map((x) => x.name)).toEqual(['01-a.png', '02-b.png']);
  });

  it('refuses a wrong size before anything is uploaded', () => {
    const dir = mkdtempSync(join(tmpdir(), 'asc-'));
    mkdirSync(join(dir, 'iphone-6.9'));
    writeFileSync(join(dir, 'iphone-6.9', '01.png'), png(1290, 2796));
    expect((collect(dir, 'iphone-6.9') as { error: string }).error).toMatch(/needs 1320x2868/);
  });

  it('refuses more than ten in a set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'asc-'));
    mkdirSync(join(dir, 'ipad-13'));
    for (let i = 0; i < 11; i++) writeFileSync(join(dir, 'ipad-13', `${String(i).padStart(2, '0')}.png`), png(2064, 2752));
    expect((collect(dir, 'ipad-13') as { error: string }).error).toMatch(/at most 10/);
  });
});
