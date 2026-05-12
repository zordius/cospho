import { createFlickrClient, fetchPhotosInAlbum, normalizePhoto } from './flickr.js';
import { readPhotos, savePhotos } from './store.js';

export async function getPhotos(version, albumId) {
  const cached = await readPhotos(version, albumId);
  if (cached.length > 0) return cached;

  const { flickr } = createFlickrClient();
  const raw = await fetchPhotosInAlbum(flickr, albumId);
  const photos = raw.map(normalizePhoto);
  await savePhotos(photos, version, albumId);
  return photos;
}
