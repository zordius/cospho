import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { buildHtml } from '@cospho/gallery';
import { listCachedAlbums, getPrimaryPhoto, getDocsDir } from '../src/index.js';

const VERSION = 'v1';
const OUT_DIR = getDocsDir();
const OUT_FILE = resolve(OUT_DIR, 'index.html');

const cachedAlbums = await listCachedAlbums(VERSION);

if (cachedAlbums.length === 0) {
  console.error('No cached albums found. Run list-photos for at least one album first.');
  process.exit(1);
}

const totalPhotos = cachedAlbums.reduce((s, a) => s + (a.photoCount ?? 0), 0);

const indexPhotos = await Promise.all(
  cachedAlbums.map(async (a) => {
    const cover = await getPrimaryPhoto(VERSION, a.id);
    const count = a.photoCount ?? 0;
    return {
      id: a.id,
      title: `${a.title} · ${count}張照片`,
      media: 'photo',
      sizes: cover?.sizes ?? {},
    };
  }),
);

const summary = `<p>共${totalPhotos}張照片</p><p>共${cachedAlbums.length}本活動相簿</p>`;

const html = buildHtml(indexPhotos, {
  title: 'Cospho',
  alwaysShowTitle: true,
  linkUrl: (p) => `albums/${p.id}.html`,
  faviconBase: '',
  eagerCount: 4,
  beforeG: summary,
});

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html);
console.log(`Index: ${relative(process.cwd(), OUT_FILE)}`);
