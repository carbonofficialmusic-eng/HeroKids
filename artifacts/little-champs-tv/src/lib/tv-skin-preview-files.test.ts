import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolveTvSkinPreviewUrl } from './tv-asset-url';

const publicRoot = new URL('../../public/', import.meta.url);
const originalRoot = new URL('../../../little-champs/public/skins/', import.meta.url);
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** Read WebP canvas dimensions without requiring ImageMagick on test/deploy machines. */
function dimensions(bytes: Buffer): [number, number] {
  expect(bytes.toString('ascii',0,4)).toBe('RIFF');
  expect(bytes.toString('ascii',8,12)).toBe('WEBP');
  for (let offset=12;offset+8<=bytes.length;) {
    const type=bytes.toString('ascii',offset,offset+4);
    const length=bytes.readUInt32LE(offset+4);
    const data=offset+8;
    if (type==='VP8X') return [1+bytes.readUIntLE(data+4,3),1+bytes.readUIntLE(data+7,3)];
    if (type==='VP8 ') return [bytes.readUInt16LE(data+6)&0x3fff,bytes.readUInt16LE(data+8)&0x3fff];
    if (type==='VP8L') {
      const bits=bytes.readUInt32LE(data+1);
      return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];
    }
    offset=data+length+(length%2);
  }
  throw new Error('WebP preview has no decodable image canvas');
}

describe('complete TV-only skin preview files',()=>{
  it('links every original skin to a valid, correctly sized TV preview without changing its source',()=>{
    const manifest=JSON.parse(readFileSync(new URL('skin-previews/manifest.json',publicRoot),'utf8'));
    const expected: string[]=[];
    for (const kind of ['avatars','backgrounds'] as const) {
      const names=readdirSync(new URL(`${kind}/`,originalRoot)).filter(name=>name.endsWith('.png'));
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        const id=name.slice(0,-4);
        const key=`${kind}/${id}.webp`;
        expected.push(key);
        const url=resolveTvSkinPreviewUrl(id,kind,'./');
        const preview=readFileSync(new URL(url,publicRoot));
        const original=readFileSync(new URL(`${kind}/${name}`,originalRoot));
        expect(manifest.files[key].sourceSha256).toBe(digest(original));
        expect(manifest.files[key].previewSha256).toBe(digest(preview));
        const [width,height]=dimensions(preview);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(width).toBeLessThanOrEqual(kind==='avatars'?256:384);
        expect(height).toBeLessThanOrEqual(kind==='avatars'?256:216);
        expect(preview.length).toBeLessThan(original.length);
      }
    }
    expect(Object.keys(manifest.files).sort()).toEqual(expected.sort());
  });

  it('supports build verification without requiring an image converter or writing files',()=>{
    const script=fileURLToPath(new URL('../../scripts/prepare-skin-previews.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script,'--check'],{encoding:'utf8'});
    expect(result.status,result.stderr).toBe(0);
    expect(result.stdout).toContain('TV-only skin previews');
  });
});