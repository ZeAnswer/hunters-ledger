let counter = 0;
/** Small unique id: prefix + base36 time + counter. Engine stays dependency-free. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}`;
}
