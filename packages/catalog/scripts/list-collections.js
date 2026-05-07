import { relative } from 'node:path';
import { createFlickrClient, asArray, text } from '../src/flickr.js';
import { getAlbums, getAlbumsPath, getCollectionId } from '../src/index.js';

const VERSION = 'v1';

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : '?';
}

function formatAlbumLine(album, indent) {
  const photos = album?.photoCount;
  const photosStr = photos != null ? `${photos} photo${photos === 1 ? '' : 's'}` : '? photos';
  const title = album.title || '(untitled)';
  return `${indent}[${album.id}] ${title} — ${photosStr}, ${formatDate(album.dateCreated)}`;
}

function printTree(collections, albumById, depth = 0) {
  for (const col of collections) {
    const albumRefs = asArray(col.set);
    const subs = asArray(col.collection);
    const indent = '  '.repeat(depth);

    const parts = [];
    if (albumRefs.length > 0)
      parts.push(`${albumRefs.length} album${albumRefs.length === 1 ? '' : 's'}`);
    if (subs.length > 0) parts.push(`${subs.length} sub-collection${subs.length === 1 ? '' : 's'}`);
    const meta = parts.length > 0 ? ` — ${parts.join(', ')}` : '';

    console.log(`${indent}[${col.id}] ${text(col.title)}${meta}`);

    const albumIndent = '  '.repeat(depth + 1);
    for (const ref of albumRefs) {
      const album = albumById.get(ref.id);
      if (album) {
        console.log(formatAlbumLine(album, albumIndent));
      } else {
        console.log(`${albumIndent}[${ref.id}] ${text(ref.title) || '(untitled)'} — ? photos, ?`);
      }
    }

    if (subs.length > 0) printTree(subs, albumById, depth + 1);
  }
}

const collectionId = getCollectionId(VERSION);
const { flickr } = createFlickrClient();

const [tree, albums] = await Promise.all([
  flickr('flickr.collections.getTree', { collection_id: collectionId }),
  getAlbums(VERSION),
]);

const albumById = new Map(albums.map((a) => [a.id, a]));
const top = asArray(tree?.collections?.collection);

if (top.length === 0) {
  console.log(`No collections found under ${collectionId}.`);
  console.log('Raw response (for debugging):');
  console.log(JSON.stringify(tree, null, 2));
  process.exit(0);
}

console.log(
  `Children of ${VERSION} root collection ${collectionId} (${albums.length} cached albums):\n`,
);
printTree(top, albumById);

console.log(`\nAlbums cache: ${relative(process.cwd(), getAlbumsPath(VERSION))}`);
