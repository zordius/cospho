import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { buildHtml } from '@cospho/gallery';
import { getIndexCovers, getIndexSprite16, getDocsDir } from '../src/index.js';

const VERSION = 'v1';
const OUT_DIR = getDocsDir();
const OUT_FILE = resolve(OUT_DIR, 'index.html');

const covers = await getIndexCovers(VERSION);

if (covers.length === 0) {
  console.error('No cached albums with covers found. Run list-photos for at least one album first.');
  process.exit(1);
}

const spriteAbs = await getIndexSprite16(VERSION, {
  onProgress: (done, total) => {
    process.stdout.write(`\r  extracting ${done}/${total}`);
    if (done === total) process.stdout.write('\n');
  },
});

const totalPhotos = covers.reduce((s, { album }) => s + (album.photoCount ?? 0), 0);

const indexPhotos = covers.map(({ album, cover }) => ({
  id: album.id,
  title: `${album.title} · ${album.photoCount ?? 0}張照片`,
  media: 'photo',
  sizes: cover.sizes,
}));

const summary = `<p>本站為針對手機最佳化版本,僅提供照片瀏覽功能</p>
<p>共${covers.length}本活動相簿·${totalPhotos}張照片</p>`;

const spriteRelativeUrl = `sprites/${basename(spriteAbs)}`;

const html = buildHtml(indexPhotos, {
  title: 'CosPho Up向上委員會·手機版',
  alwaysShowTitle: true,
  linkUrl: (p) => `albums/${p.id}.html`,
  faviconBase: '',
  beforeG: summary,
  sprite: { url: spriteRelativeUrl, blockSize: 16, cols: 10 },
});

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html);
console.log(`Index: ${relative(process.cwd(), OUT_FILE)}`);
