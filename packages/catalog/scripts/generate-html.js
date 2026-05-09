import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { buildHtml } from '@cospho/gallery';
import { getAlbums, getPhotos, getAlbumSprite16, getDocsDir } from '../src/index.js';

const VERSION = 'v1';
const albumId = process.argv[2];

if (!albumId) {
  console.error('Usage: pnpm --filter @cospho/catalog generate-html <album_id>');
  process.exit(1);
}

const [albums, photos, spriteAbs] = await Promise.all([
  getAlbums(VERSION),
  getPhotos(VERSION, albumId),
  getAlbumSprite16(VERSION, albumId, {
    onProgress: (done, total) => {
      process.stdout.write(`\r  downloading ${done}/${total}`);
      if (done === total) process.stdout.write('\n');
    },
  }),
]);

const album = albums.find((a) => a.id === albumId);
const title = album?.title || `Album ${albumId}`;
const count = album?.photoCount ?? photos.length;

const outDir = resolve(getDocsDir(), 'albums');
const outFile = resolve(outDir, `${albumId}.html`);

// HTML lives at docs/albums/<id>.html, sprite at docs/sprites/<id>-16.png
const spriteRelativeUrl = `../sprites/${basename(spriteAbs)}`;

const html = buildHtml(photos, {
  width: 390,
  title,
  sprite: { url: spriteRelativeUrl, blockSize: 16, cols: 10 },
  beforeG: `<p>${count}張照片</p>`,
});

await mkdir(outDir, { recursive: true });
await writeFile(outFile, html);

console.log(`HTML: ${relative(process.cwd(), outFile)}`);
