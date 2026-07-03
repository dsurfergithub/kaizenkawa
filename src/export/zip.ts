/** Escritor de ZIP sin compresión (método "store"), suficiente para WAVs y sin dependencias. */

interface Entry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(files: Array<{ name: string; data: ArrayBuffer | string }>): Blob {
  const encoder = new TextEncoder();
  const entries: Entry[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  const push = (bytes: Uint8Array) => {
    parts.push(bytes);
    offset += bytes.length;
  };

  for (const file of files) {
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : new Uint8Array(file.data);
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(data);
    entries.push({ name: file.name, data, crc, offset });

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true); // versión
    header.setUint16(8, 0, true); // método: store
    header.setUint32(14, crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, nameBytes.length, true);
    push(new Uint8Array(header.buffer));
    push(nameBytes);
    push(data);
  }

  const centralStart = offset;
  for (const e of entries) {
    const nameBytes = encoder.encode(e.name);
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(10, 0, true);
    header.setUint32(16, e.crc, true);
    header.setUint32(20, e.data.length, true);
    header.setUint32(24, e.data.length, true);
    header.setUint16(28, nameBytes.length, true);
    header.setUint32(42, e.offset, true);
    push(new Uint8Array(header.buffer));
    push(nameBytes);
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, offset - centralStart, true);
  end.setUint32(16, centralStart, true);
  push(new Uint8Array(end.buffer));

  return new Blob(parts as BlobPart[], { type: 'application/zip' });
}
