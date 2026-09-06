/** Key/value document storage. Web: IndexedDB. Android: Capacitor Filesystem (app-private). */
export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
  /** Hand a text file to the user (download on web, share sheet on Android). */
  exportFile(name: string, text: string): Promise<void>;
  /** Ask the user for a text file. Resolves undefined if cancelled. */
  importFile(): Promise<{ name: string; text: string } | undefined>;
  readonly kind: 'web' | 'android';
}
