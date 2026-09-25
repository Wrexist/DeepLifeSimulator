/**
 * Android AsyncStorage caps its database at 6 MB unless gradle.properties sets
 * `AsyncStorage_db_size_in_MB`. Two late-game save slots exceed 6 MB and every
 * save then fails with SQLITE_FULL. The value is set in two places - the
 * committed android/gradle.properties and the config plugin that writes it on
 * prebuild - so this pins both, and that they agree.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withAsyncStorageSize');

describe('Android AsyncStorage database size', () => {
  it('is raised in the committed gradle.properties', () => {
    const props = fs.readFileSync(path.join(ROOT, 'android', 'gradle.properties'), 'utf8');
    const m = /^AsyncStorage_db_size_in_MB=(\d+)$/m.exec(props);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(32);
    expect(m![1]).toBe(plugin.ASYNC_STORAGE_DB_SIZE_MB);
  });

  it('is registered as a config plugin so prebuild keeps it', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app.config.js'), 'utf8');
    expect(src).toContain('"./plugins/withAsyncStorageSize"');
  });
});
