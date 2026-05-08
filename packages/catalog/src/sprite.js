import { mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import { getDocsDir } from './store.js';
import { getPhotos } from './photos.js';

const COLS = 10;
const DOWNLOAD_CONCURRENCY = 4;

function spritePath(version, albumId, blockSize) {
  return resolve(getDocsDir(), 'sprites', `${albumId}-${blockSize}.png`);
}

export function getSpritePath(version, albumId, blockSize) {
  return spritePath(version, albumId, blockSize);
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
