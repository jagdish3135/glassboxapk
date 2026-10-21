// Parser for Android binary XML (the compiled AndroidManifest.xml inside an APK).

export interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

const CHUNK_STRING_POOL = 0x0001;
const CHUNK_RESOURCE_MAP = 0x0180;
const CHUNK_START_ELEMENT = 0x0102;
const CHUNK_END_ELEMENT = 0x0103;

// Framework attribute resource IDs, used when obfuscators strip attribute names.
const ATTR_BY_RES_ID: Record<number, string> = {
  0x01010001: 'label',
  0x01010003: 'name',
  0x01010006: 'permission',
  0x01010010: 'exported',
  0x01010027: 'scheme',
  0x01010028: 'host',
  0x0101002a: 'path',
  0x0101002b: 'pathPrefix',
  0x0101002c: 'pathPattern',
  0x0101020c: 'minSdkVersion',
  0x0101021b: 'versionCode',
  0x0101021c: 'versionName',
  0x01010270: 'targetSdkVersion',
};

function readStringPool(view: DataView, start: number): string[] {
  const headerSize = view.getUint16(start + 2, true);
  const count = view.getUint32(start + 8, true);
  const flags = view.getUint32(start + 16, true);
  const stringsStart = view.getUint32(start + 20, true);
  const utf8 = (flags & (1 << 8)) !== 0;
  const offsetsBase = start + headerSize;
  const dataBase = start + stringsStart;
  const out: string[] = new Array(count);
  const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const dec8 = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    let p = dataBase + view.getUint32(offsetsBase + i * 4, true);
    if (utf8) {
      // UTF-16 length, then UTF-8 byte length; each is 1 or 2 bytes.
      p += (u8[p] & 0x80) ? 2 : 1;
      let len = u8[p];
      if (len & 0x80) {
        len = ((len & 0x7f) << 8) | u8[p + 1];
        p += 2;
      } else p += 1;
      out[i] = dec8.decode(u8.subarray(p, p + len));
    } else {
      let len = view.getUint16(p, true);
      if (len & 0x8000) {
        len = ((len & 0x7fff) << 16) | view.getUint16(p + 2, true);
        p += 4;
      } else p += 2;
      let s = '';
      for (let j = 0; j < len; j++) s += String.fromCharCode(view.getUint16(p + j * 2, true));
      out[i] = s;
    }
  }
  return out;
}

function formatValue(dataType: number, data: number, strings: string[]): string {
  switch (dataType) {
    case 0x03: return strings[data] ?? '';
    case 0x01: return '@0x' + (data >>> 0).toString(16);
    case 0x10: return String(data | 0);
    case 0x11: return '0x' + (data >>> 0).toString(16);
    case 0x12: return data !== 0 ? 'true' : 'false';
    default: return String(data >>> 0);
  }
}

export function parseAxml(buf: ArrayBuffer): XmlNode {
  const view = new DataView(buf);
  let strings: string[] = [];
  let resIds: number[] = [];
  const root: XmlNode = { tag: '#document', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];

  let p = view.getUint16(2, true); // skip the file header chunk
  while (p + 8 <= view.byteLength) {
    const type = view.getUint16(p, true);
    const size = view.getUint32(p + 4, true);
    if (size < 8) break;

    if (type === CHUNK_STRING_POOL) {
      strings = readStringPool(view, p);
    } else if (type === CHUNK_RESOURCE_MAP) {
      const hs = view.getUint16(p + 2, true);
      resIds = [];
      for (let q = p + hs; q < p + size; q += 4) resIds.push(view.getUint32(q, true));
    } else if (type === CHUNK_START_ELEMENT) {
      const ext = p + 16;
      const name = strings[view.getUint32(ext + 4, true)] ?? '?';
      const attrStart = view.getUint16(ext + 8, true);
      const attrSize = view.getUint16(ext + 10, true);
      const attrCount = view.getUint16(ext + 12, true);
      const node: XmlNode = { tag: name, attrs: {}, children: [] };
      for (let i = 0; i < attrCount; i++) {
        const a = ext + attrStart + i * attrSize;
        const nameIdx = view.getUint32(a + 4, true);
        const raw = view.getUint32(a + 8, true);
        const dataType = view.getUint8(a + 15);
        const data = view.getUint32(a + 16, true);
        let attrName = strings[nameIdx] ?? '';
        if (!attrName && nameIdx < resIds.length) attrName = ATTR_BY_RES_ID[resIds[nameIdx]] ?? '';
        if (!attrName) continue;
        node.attrs[attrName] = raw !== 0xffffffff ? strings[raw] ?? '' : formatValue(dataType, data, strings);
      }
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else if (type === CHUNK_END_ELEMENT) {
      if (stack.length > 1) stack.pop();
    }
    p += size;
  }
  return root.children[0] ?? root;
}

export function findAll(node: XmlNode, tag: string, out: XmlNode[] = []): XmlNode[] {
  for (const c of node.children) {
    if (c.tag === tag) out.push(c);
    findAll(c, tag, out);
  }
  return out;
}

export function child(node: XmlNode, tag: string): XmlNode | undefined {
  return node.children.find((c) => c.tag === tag);
}
