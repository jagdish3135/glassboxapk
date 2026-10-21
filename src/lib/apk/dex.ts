// Minimal DEX reader: class descriptors from type_ids, plus string constants that
// look like URLs or API paths. Enough for SDK detection and endpoint discovery.

export interface DexFacts {
  classes: string[];
  urls: string[];
  apiPaths: string[];
}

const dec = new TextDecoder('utf-8', { fatal: false });
const API_PATH = /^\/?(api\/)?v\d+(\/[\w{}.-]+)+\/?$/;

function readUleb(u8: Uint8Array, p: number): [number, number] {
  let result = 0;
  let shift = 0;
  let b: number;
  do {
    b = u8[p++];
    result |= (b & 0x7f) << shift;
    shift += 7;
  } while (b & 0x80 && shift < 35);
  return [result >>> 0, p];
}

function stringAt(u8: Uint8Array, off: number): string {
  const [, p] = readUleb(u8, off);
  let end = p;
  while (end < u8.length && u8[end] !== 0) end++;
  return dec.decode(u8.subarray(p, end));
}

export function readDex(buf: ArrayBuffer): DexFacts {
  const u8 = new Uint8Array(buf);
  const view = new DataView(buf);
  if (u8[0] !== 0x64 || u8[1] !== 0x65 || u8[2] !== 0x78) throw new Error('Not a DEX file');

  const stringIdsSize = view.getUint32(0x38, true);
  const stringIdsOff = view.getUint32(0x3c, true);
  const typeIdsSize = view.getUint32(0x40, true);
  const typeIdsOff = view.getUint32(0x44, true);

  const classes: string[] = [];
  for (let i = 0; i < typeIdsSize; i++) {
    const strIdx = view.getUint32(typeIdsOff + i * 4, true);
    const s = stringAt(u8, view.getUint32(stringIdsOff + strIdx * 4, true));
    if (s.length > 2 && s[0] === 'L') classes.push(s);
  }

  const urls: string[] = [];
  const apiPaths: string[] = [];
  for (let i = 0; i < stringIdsSize; i++) {
    const off = view.getUint32(stringIdsOff + i * 4, true);
    const [len, p] = readUleb(u8, off);
    if (len < 4 || len > 300) continue;
    const c0 = u8[p];
    // Cheap first-byte filter before decoding: 'h' for URLs, 'v', '/', 'a' for API paths.
    if (c0 === 0x68 && u8[p + 1] === 0x74 && u8[p + 2] === 0x74 && u8[p + 3] === 0x70) {
      urls.push(stringAt(u8, off));
    } else if (c0 === 0x76 || c0 === 0x2f || c0 === 0x61) {
      const s = stringAt(u8, off);
      if (API_PATH.test(s)) apiPaths.push(s);
    }
  }
  return { classes, urls, apiPaths };
}
