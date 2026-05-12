import {
  createFlickrClient,
  fetchPhotosInAlbum,
  fetchPhotoExifOrientation,
  normalizePhoto,
  attachOrientation,
  createRateLimiter,
} from './flickr.js';
import { readPhotos, savePhotos } from './store.js';

// Flickr allows 3600 queries/hour (~1/sec). 400ms = 2.5/sec — over the
// sustained limit but typically fine for short bursts; bump higher if 503s
// start appearing.
const EXIF_INTERVAL_MS = Number(process.env.FLICKR_EXIF_INTERVAL_MS) || 400;

async function enrichWithOrientation(flickr, photos, onProgress) {
  if (photos.length === 0) return [];
  const throttle = createRateLimiter(EXIF_INTERVAL_MS);
  const out = new Array(photos.length);

  // Probe the first photo. In practice a Flickr album either has exif on
  // every photo or on none, so a missing orientation here lets us skip the
  // remaining per-photo exif calls.
  await throttle();
  const firstOrientation = await fetchPhotoExifOrientation(flickr, photos[0].id).catch(
    () => undefined,
  );
  out[0] = attachOrientation(photos[0], firstOrientation);
  onProgress?.(1, photos.length);

  if (firstOrientation === undefined) {
    for (let i = 1; i < photos.length; i += 1) out[i] = photos[i];
    onProgress?.(photos.length, photos.length);
    return out;
  }

  let done = 1;
  await Promise.all(
    photos.slice(1).map(async (p, idx) => {
      await throttle();
      const orientation = await fetchPhotoExifOrientation(flickr, p.id).catch(() => undefined);
      out[idx + 1] = attachOrientation(p, orientation);
      done += 1;
      onProgress?.(done, photos.length);
    }),
  );
  return out;
}

export async function getPhotos(version, albumId, { onProgress } = {}) {
  const cached = await readPhotos(version, albumId);
  if (cached.length > 0) return cached;

  const { flickr } = createFlickrClient();
  const raw = await fetchPhotosInAlbum(flickr, albumId);
  const photos = raw.map(normalizePhoto);
  const enriched = await enrichWithOrientation(flickr, photos, onProgress);
  await savePhotos(enriched, version, albumId);
  return enriched;
}
