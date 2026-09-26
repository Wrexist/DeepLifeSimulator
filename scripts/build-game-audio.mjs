import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
// Original synthesized cues: no recordings, samples, network or licensing dependency.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/audio');
fs.mkdirSync(output, { recursive: true });
const cues = {
  button_click: { notes: [660], step: 0.035, tail: 0.045 },
  success: { notes: [523.25, 659.25, 783.99], step: 0.075, tail: 0.18 },
  error: { notes: [293.66, 261.63], step: 0.07, tail: 0.12 },
  notification: { notes: [783.99, 1046.5], step: 0.07, tail: 0.16 },
  money: { notes: [659.25, 880], step: 0.055, tail: 0.13 },
  level_up: { notes: [523.25, 659.25, 783.99, 1046.5], step: 0.08, tail: 0.24 },
  week: { notes: [392, 523.25, 659.25], step: 0.06, tail: 0.16 },
};
const assets = [];
for (const [id, cue] of Object.entries(cues)) {
  const rate = 22050, length = Math.ceil((cue.notes.length * cue.step + cue.tail) * rate);
  const data = Buffer.alloc(length * 2 + 44);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / rate;
    let v = 0;
    cue.notes.forEach((frequency, index) => {
      const age = t - index * cue.step;
      if (age < 0 || age > cue.tail + cue.step) return;
      const attack = Math.min(1, age / 0.008), decay = Math.exp(-age * 22);
      const release = Math.min(1, (cue.tail + cue.step - age) / 0.03);
      v += Math.sin(2 * Math.PI * frequency * age) * attack * decay * release * 0.22;
    });
    data.writeInt16LE(Math.round(Math.max(-0.8, Math.min(0.8, v)) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(output, `${id}.wav`), data);
  assets.push({ id, file: `${id}.wav`, bytes: data.length, duration: length / rate, sha256: createHash('sha256').update(data).digest('hex') });
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ source: 'scripts/build-game-audio.mjs', provenance: 'Project-original synthesized sine tones; no third-party samples.', sampleRate: 22050, channels: 1, assets }, null, 2) + '\n');
console.log(`Generated ${assets.length} local cues, ${assets.reduce((n, a) => n + a.bytes, 0)} bytes`);
