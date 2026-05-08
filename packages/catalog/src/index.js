import { access } from 'node:fs/promises';
import { getAlbums } from './albums.js';
import { getPhotos } from './photos.js';
import { getPhotosPath } from './store.js';

export { getCollectionId, getAlbums } from './albums.js';
export { getPhotos } from './photos.js';
export { getAlbumSprite16, getSpritePath } from './sprite.js';
export {
  saveAlbums,
  readAlbums,
  getAlbumsPath,
  getDataDir,
  getDocsDir,
  readPhotos,
  savePhotos,
  getPhotosPath,
} from './store.js';

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
