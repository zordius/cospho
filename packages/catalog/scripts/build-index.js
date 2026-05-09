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

// Each album becomes a "photo" record using its cover photo's sizes.
const indexPhotos = await Promise.all(
  cachedAlbums.map(async (a) => {
    const cover = await getPrimaryPhoto(VERSION, a.id);
    return {
      id: a.id,
      title: a.title,
      media: 'photo',
      sizes: cover?.sizes ?? {},
    };
  }),
);

const html = buildHtml(indexPhotos, {
  title: 'Cospho',
  alwaysShowTitle: true,
  linkUrl: (p) => `albums/${p.id}.html`,
  faviconBase: '',
  eagerCount: 4,
});

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html);
console.log(`Index: ${relative(process.cwd(), OUT_FILE)}`);
