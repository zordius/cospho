import {
  createFlickrClient,
  fetchPhotosets,
  collectAlbumsFromTree,
  fetchPhotosInAlbum,
  normalizePhoto,
} from './flickr.js';
import { readAlbums, saveAlbums, readPhotos, savePhotos } from './store.js';

const COLLECTION_IDS = {
  v1: '72157600057261241',
  v2: '72157724912260499',
};

export {
  saveAlbums,
  readAlbums,
  getAlbumsPath,
  getDataDir,
  readPhotos,
  savePhotos,
  getPhotosPath,
} from './store.js';

export function getCollectionId(version) {
  const id = COLLECTION_IDS[version];
  if (!id) {
    throw new Error(`No collection id configured for version "${version}".`);
  }
  return id;
}

export async function getAlbums(version) {
  const cached = await readAlbums(version);
  if (cached.length > 0) return cached;

  const collectionId = getCollectionId(version);
  const { flickr } = createFlickrClient();
  const [tree, photosets] = await Promise.all([
    flickr('flickr.collections.getTree', { collection_id: collectionId }),
    fetchPhotosets(flickr),
  ]);
  const albums = collectAlbumsFromTree(tree, photosets);
  await saveAlbums(albums, version);
  return albums;
}

export async function getPhotos(version, albumId) {
  const cached = await readPhotos(version, albumId);
  if (cached.length > 0) return cached;

  const { flickr } = createFlickrClient();
  const raw = await fetchPhotosInAlbum(flickr, albumId);
  const photos = raw.map(normalizePhoto);
  await savePhotos(photos, version, albumId);
  return photos;
}
