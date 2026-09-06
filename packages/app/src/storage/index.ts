import type { StorageAdapter } from './adapter';
import { webStorage } from './web';
import { capacitorStorage, isNative } from './capacitor';

const adapter: StorageAdapter = isNative() ? capacitorStorage : webStorage;
export function storage(): StorageAdapter { return adapter; }
export type { StorageAdapter };
