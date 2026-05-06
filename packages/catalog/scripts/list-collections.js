import { relative } from 'node:path';
import { createFlickrClient, asArray, text } from '../src/flickr.js';
import { saveAlbums, getAlbumsPath } from '../src/index.js';

const ROOT_COLLECTION_ID = '72157600057261241';
const PER_PAGE = 500;

async function fetchAllPhotosets(flickr) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await flickr('flickr.photosets.getList', {
      page: String(page),
      per_page: String(PER_PAGE),
    });
    all.push(...asArray(res?.photosets?.photoset));
    const totalPages = Number(res?.photosets?.pages ?? 1);
    if (page >= totalPages) break;
    page += 1;
  }
  return all;
}

function toIso(unixSeconds) {
  if (!unixSeconds) return null;
  const ms = Number(unixSeconds) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : '?';
}

function normalizeAlbum(set) {
  const photoCount = Number(set?.photos);
  const videoCount = Number(set?.videos);
  return {
    id: set.id,
    title: text(set.title),
    description: text(set.description),
    photoCount: Number.isFinite(photoCount) ? photoCount : null,
    videoCount: Number.isFinite(videoCount) ? videoCount : null,
    primaryPhotoId: set?.primary ?? null,
    dateCreated: toIso(set?.date_create),
    dateUpdated: toIso(set?.date_update),
  };
}

function collectAlbumsInTreeOrder(collections, setById) {
  const out = [];
  const seen = new Set();
  function walk(cols) {
    for (const col of cols) {
      for (const album of asArray(col.set)) {
        if (seen.has(album.id)) continue;
        seen.add(album.id);
        const meta = setById.get(album.id);
        if (!meta) {
          console.warn(`Warning: album ${album.id} in tree but not in photosets.getList; skipping`);
          continue;
        }
        out.push(normalizeAlbum(meta));
      }
      walk(asArray(col.collection));
    }
  }
  walk(collections);
  return out;
}

function formatAlbumLine(albumFromTree, setById, indent) {
  const meta = setById.get(albumFromTree.id);
  const title = text(meta?.title) || text(albumFromTree.title) || '(untitled)';
  const count = Number(meta?.photos);
  const photosStr = Number.isFinite(count) ? `${count} photo${count === 1 ? '' : 's'}` : '? photos';
  return `${indent}[${albumFromTree.id}] ${title} — ${photosStr}, ${formatDate(toIso(meta?.date_create))}`;
}

function printTree(collections, setById, depth = 0) {
  for (const col of collections) {
    const albums = asArray(col.set);
    const subs = asArray(col.collection);
    const indent = '  '.repeat(depth);

    const parts = [];
    if (albums.length > 0) parts.push(`${albums.length} album${albums.length === 1 ? '' : 's'}`);
    if (subs.length > 0) parts.push(`${subs.length} sub-collection${subs.length === 1 ? '' : 's'}`);
    const meta = parts.length > 0 ? ` — ${parts.join(', ')}` : '';

    console.log(`${indent}[${col.id}] ${text(col.title)}${meta}`);

    const albumIndent = '  '.repeat(depth + 1);
    for (const album of albums) {
      console.log(formatAlbumLine(album, setById, albumIndent));
    }

    if (subs.length > 0) printTree(subs, setById, depth + 1);
  }
}

const { flickr } = createFlickrClient();

const [treeRes, photosets] = await Promise.all([
  flickr('flickr.collections.getTree', { collection_id: ROOT_COLLECTION_ID }),
  fetchAllPhotosets(flickr),
]);

const setById = new Map(photosets.map((s) => [s.id, s]));
const top = asArray(treeRes?.collections?.collection);

if (top.length === 0) {
  console.log(`No collections found under root collection ${ROOT_COLLECTION_ID}.`);
  console.log('Raw response (for debugging):');
  console.log(JSON.stringify(treeRes, null, 2));
  process.exit(0);
}

console.log(
  `Children of root collection ${ROOT_COLLECTION_ID} (${photosets.length} total albums on account):\n`,
);
printTree(top, setById);

const albums = collectAlbumsInTreeOrder(top, setById);
await saveAlbums(albums);

console.log(`\nSaved ${albums.length} albums to ${relative(process.cwd(), getAlbumsPath())}`);
