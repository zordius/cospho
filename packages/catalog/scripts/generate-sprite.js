import { relative } from 'node:path';
import { getAlbumSprite16 } from '../src/index.js';

const VERSION = 'v1';
const albumId = process.argv[2];

if (!albumId) {
  console.error('Usage: pnpm --filter @cospho/catalog generate-sprite <album_id>');
  process.exit(1);
}

const path = await getAlbumSprite16(VERSION, albumId, {
  onProgress: (done, total) => {
    process.stdout.write(`\r  downloading ${done}/${total}`);
    if (done === total) process.stdout.write('\n');
  },
});

console.log(`16×16 sprite: ${relative(process.cwd(), path)}`);
