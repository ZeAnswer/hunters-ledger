import type { StorageAdapter } from './adapter';
import { webStorage } from './web';

let adapter: StorageAdapter = webStorage;
export function setStorageAdapter(a: StorageAdapter) { adapter = a; }
export function storage(): StorageAdapter { return adapter; }
export type { StorageAdapter };
