import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../data');

function albumsPath(version) {
  return resolve(DATA_DIR, version, 'albums.json');
}

function photosPath(version, albumId) {
  return resolve(DATA_DIR, version, 'photos', `${albumId}.json`);
}

export function getDataDir() {
  return DATA_DIR;
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

// Photos are stored sorted by title-as-int. Throws if any title isn't numeric.
function compareTitleAsInt(a, b) {
  const aN = parseInt(a.title, 10);
  const bN = parseInt(b.title, 10);
  if (Number.isNaN(aN)) {
    throw new Error(`Photo ${a.id} has non-numeric title "${a.title}"; cannot sort.`);
  }
  if (Number.isNaN(bN)) {
    throw new Error(`Photo ${b.id} has non-numeric title "${b.title}"; cannot sort.`);
  }
  return aN - bN;
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
