import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../data');
const DOCS_DIR = resolve(import.meta.dirname, '../../../docs');

function albumsPath(version) {
  return resolve(DATA_DIR, version, 'albums.json');
}

function photosPath(version, albumId) {
  return resolve(DATA_DIR, version, 'photos', `${albumId}.json`);
}

export function getDataDir() {
  return DATA_DIR;
}

export function getDocsDir() {
  return DOCS_DIR;
}

export function getAlbumsPath(version) {
  return albumsPath(version);
}

export function getPhotosPath(version, albumId) {
  return photosPath(version, albumId);
}

export async function readAlbums(version) {
  try {
    const buf = await readFile(albumsPath(version), 'utf8');
    return JSON.parse(buf);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Static-data semantics: existing entries (matched by id) are preserved
// byte-identical. New albums are appended; existing ids in `albums` are skipped.
export async function saveAlbums(albums, version) {
  const path = albumsPath(version);
  const existing = await readAlbums(version);
  const seen = new Set(existing.map((a) => a.id));
  const merged = [...existing];
  for (const album of albums) {
    if (!seen.has(album.id)) {
      merged.push(album);
      seen.add(album.id);
    }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(merged, null, 2) + '\n');
}

export async function readPhotos(version, albumId) {
  try {
    const buf = await readFile(photosPath(version, albumId), 'utf8');
    return JSON.parse(buf);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Photos are stored sorted by title-as-int. Non-numeric titles sort as 0.
function compareTitleAsInt(a, b) {
  const aN = parseInt(a.title, 10);
  const bN = parseInt(b.title, 10);
  return (Number.isNaN(aN) ? 0 : aN) - (Number.isNaN(bN) ? 0 : bN);
}

export async function savePhotos(photos, version, albumId) {
  const path = photosPath(version, albumId);
  const existing = await readPhotos(version, albumId);
  const seen = new Set(existing.map((p) => p.id));
  const merged = [...existing];
  for (const photo of photos) {
    if (!seen.has(photo.id)) {
      merged.push(photo);
      seen.add(photo.id);
    }
  }
  merged.sort(compareTitleAsInt);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(merged, null, 2) + '\n');
}
