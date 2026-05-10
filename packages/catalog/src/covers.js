import { access } from 'node:fs/promises';
import { getAlbums } from './albums.js';
import { getPhotos } from './photos.js';
import { getPhotosPath } from './store.js';

export async function listCachedAlbums(version) {
  const albums = await getAlbums(version);
  const checks = await Promise.all(
    albums.map(async (a) => {
      try {
        await access(getPhotosPath(version, a.id));
        return a;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter(Boolean);
}

export async function getPrimaryPhoto(version, albumId) {
  const albums = await getAlbums(version);
  const album = albums.find((a) => a.id === albumId);
  if (!album?.primaryPhotoId) return null;
  const photos = await getPhotos(version, albumId);
  return photos.find((p) => p.id === album.primaryPhotoId) ?? null;
}

// For each cached album with a primary photo, return the album, its cover photo,
// and the cover's index inside the album's sprite (eligible-photo order).
// Albums without a usable cover are skipped, so the returned order matches what
// buildHtml will render and what the index sprite expects.
export async function getIndexCovers(version) {
  const albums = await listCachedAlbums(version);
  const out = [];
  for (const album of albums) {
    if (!album.primaryPhotoId) continue;
    const photos = await getPhotos(version, album.id);
    const eligible = photos.filter((p) => p.media === 'photo' && p.sizes?.s?.url);
    const eligibleIdx = eligible.findIndex((p) => p.id === album.primaryPhotoId);
    if (eligibleIdx === -1) continue;
    out.push({ album, cover: eligible[eligibleIdx], eligibleIdx });
  }
  return out;
}
