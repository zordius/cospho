import { relative } from 'node:path';
import { getPhotos, getPhotosPath } from '../src/index.js';

const VERSION = 'v1';
const albumId = process.argv[2];

if (!albumId) {
  console.error('Usage: pnpm --filter @cospho/catalog list-photos <album_id>');
  process.exit(1);
}

const photos = await getPhotos(VERSION, albumId);

if (photos.length === 0) {
  console.log(`No photos found for album ${albumId}.`);
  process.exit(0);
}

console.log(`Album ${albumId}: ${photos.length} photos\n`);

for (const p of photos) {
  const date = p.dateTaken ? p.dateTaken.slice(0, 10) : '?';
  const o = p.sizes?.original;
  const dim = o?.width && o?.height ? `${o.width}×${o.height}` : '?';
  const fmt = p.originalFormat ?? '?';
  const title = p.title || '(untitled)';
  const mediaTag = p.media === 'video' ? ' [video]' : '';
  console.log(`[${p.id}] ${title} — ${dim} ${fmt}, ${date}${mediaTag}`);
}

console.log(`\nPhotos cache: ${relative(process.cwd(), getPhotosPath(VERSION, albumId))}`);
