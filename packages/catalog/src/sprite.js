import { mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import { getDocsDir } from './store.js';
import { getPhotos } from './photos.js';
import { getIndexCovers } from './covers.js';

const COLS = 10;
const DOWNLOAD_CONCURRENCY = 4;

function spritePath(version, albumId, blockSize) {
  return resolve(getDocsDir(), 'sprites', `${albumId}-${blockSize}.png`);
}

export function getSpritePath(version, albumId, blockSize) {
  return spritePath(version, albumId, blockSize);
}

export function getIndexSpritePath(blockSize = 16) {
  return resolve(getDocsDir(), 'sprites', `index-${blockSize}.png`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadAndResize(url, blockSize) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf).resize(blockSize, blockSize, { fit: 'fill' }).toBuffer();
}

async function downloadAll(urls, blockSize, onProgress) {
  const out = new Array(urls.length);
  let done = 0;
  for (let i = 0; i < urls.length; i += DOWNLOAD_CONCURRENCY) {
    const batch = urls.slice(i, i + DOWNLOAD_CONCURRENCY);
    const results = await Promise.all(batch.map((u) => downloadAndResize(u, blockSize)));
    for (let j = 0; j < results.length; j += 1) {
      out[i + j] = results[j];
      done += 1;
      onProgress?.(done, urls.length);
    }
  }
  return out;
}

export async function getAlbumSprite16(version, albumId, { onProgress } = {}) {
  const blockSize = 16;
  const path = spritePath(version, albumId, blockSize);
  if (await fileExists(path)) return path;

  const photos = await getPhotos(version, albumId);
  const eligible = photos.filter((p) => p.media === 'photo' && p.sizes?.s?.url);
  if (eligible.length === 0) {
    throw new Error(`No eligible photos for album ${albumId}`);
  }

  const urls = eligible.map((p) => p.sizes.s.url);
  const tiles = await downloadAll(urls, blockSize, onProgress);

  const cols = COLS;
  const rows = Math.ceil(eligible.length / cols);
  const width = cols * blockSize;
  const height = rows * blockSize;

  const composites = tiles.map((input, i) => ({
    input,
    left: (i % cols) * blockSize,
    top: Math.floor(i / cols) * blockSize,
  }));

  await mkdir(dirname(path), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path);

  return path;
}

// Build the index sprite by slicing cover tiles out of each album's existing
// sprite — no network needed. Skips albums whose sprite isn't built yet.
export async function getIndexSprite16(version, { onProgress } = {}) {
  const blockSize = 16;
  const cols = COLS;
  const outPath = getIndexSpritePath(blockSize);
  if (await fileExists(outPath)) return outPath;

  const covers = await getIndexCovers(version);
  if (covers.length === 0) {
    throw new Error('No eligible covers to build index sprite');
  }
  const tiles = [];
  for (const { album, eligibleIdx } of covers) {
    const aSpritePath = spritePath(version, album.id, blockSize);
    if (!(await fileExists(aSpritePath))) {
      throw new Error(`Missing album sprite for ${album.id} (${album.title}); generate album sprites first`);
    }
    const c = eligibleIdx % cols;
    const r = Math.floor(eligibleIdx / cols);
    const tile = await sharp(aSpritePath)
      .extract({ left: c * blockSize, top: r * blockSize, width: blockSize, height: blockSize })
      .toBuffer();
    tiles.push(tile);
    onProgress?.(tiles.length, covers.length);
  }

  const rows = Math.ceil(tiles.length / cols);
  const composites = tiles.map((input, i) => ({
    input,
    left: (i % cols) * blockSize,
    top: Math.floor(i / cols) * blockSize,
  }));

  await mkdir(dirname(outPath), { recursive: true });
  await sharp({
    create: {
      width: cols * blockSize,
      height: rows * blockSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  return outPath;
}
