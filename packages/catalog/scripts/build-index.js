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

const summary = `<p>本站為針對手機最佳化版本,僅提供照片瀏覽功能</p>
<p>共${cachedAlbums.length}本活動相簿·${totalPhotos}張照片</p>`;

const html = buildHtml(indexPhotos, {
  title: 'CosPho Up向上委員會·手機版',
  alwaysShowTitle: true,
  linkUrl: (p) => `albums/${p.id}.html`,
  faviconBase: '',
  beforeG: summary,
});

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html);
console.log(`Index: ${relative(process.cwd(), OUT_FILE)}`);
