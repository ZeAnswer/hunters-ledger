import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { StorageAdapter } from './adapter';

const DIR = Directory.Data; // app-private, survives browser data clears, removed only on uninstall
const file = (key: string) => `hl/${key}.json`;

export const capacitorStorage: StorageAdapter = {
  kind: 'android',
  async get(key) {
    try {
      const r = await Filesystem.readFile({ path: file(key), directory: DIR, encoding: Encoding.UTF8 });
      return JSON.parse(r.data as string);
    } catch {
      return undefined;
    }
  },
  async set(key, value) {
    await Filesystem.writeFile({ path: file(key), directory: DIR, encoding: Encoding.UTF8, data: JSON.stringify(value), recursive: true });
  },
  async remove(key) {
    try { await Filesystem.deleteFile({ path: file(key), directory: DIR }); } catch { /* missing is fine */ }
  },
  async keys() {
    try { return (await Filesystem.readdir({ path: 'hl', directory: DIR })).files.map((f) => f.name.replace(/\.json$/, '')); } catch { return []; }
  },
  async exportFile(name, text) {
    const w = await Filesystem.writeFile({ path: `export/${name}`, directory: Directory.Cache, encoding: Encoding.UTF8, data: text, recursive: true });
    await Share.share({ title: name, url: w.uri, dialogTitle: 'Save or send backup' });
  },
  importFile() {
    // The system file picker via an <input type=file> works inside the Capacitor WebView too.
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json,text/plain';
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? { name: f.name, text: await f.text() } : undefined);
      };
      input.oncancel = () => resolve(undefined);
      input.click();
    });
  },
};

export const isNative = () => Capacitor.isNativePlatform();
