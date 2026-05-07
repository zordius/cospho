import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../data');

function albumsPath(version) {
  return resolve(DATA_DIR, version, 'albums.json');
}

export function getDataDir() {
  return DATA_DIR;
}

export function getAlbumsPath(version) {
  return albumsPath(version);
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
