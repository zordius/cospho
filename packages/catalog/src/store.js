import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../data');
const ALBUMS_FILE = resolve(DATA_DIR, 'albums.json');

export function getDataDir() {
  return DATA_DIR;
}

export function getAlbumsPath() {
  return ALBUMS_FILE;
}

export async function saveAlbums(albums) {
  await mkdir(dirname(ALBUMS_FILE), { recursive: true });
  await writeFile(ALBUMS_FILE, JSON.stringify(albums, null, 2) + '\n');
}

export async function readAlbums() {
  try {
    const buf = await readFile(ALBUMS_FILE, 'utf8');
    return JSON.parse(buf);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
