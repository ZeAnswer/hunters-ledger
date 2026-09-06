import { get, set, del, keys } from 'idb-keyval';
import type { StorageAdapter } from './adapter';

export const webStorage: StorageAdapter = {
  kind: 'web',
  get: (key) => get(key),
  set: (key, value) => set(key, value),
  remove: (key) => del(key),
  keys: async () => (await keys()).map(String),
  async exportFile(name, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(undefined);
        resolve({ name: file.name, text: await file.text() });
      };
      input.oncancel = () => resolve(undefined);
      input.click();
    });
  },
};
