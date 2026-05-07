import { createFlickr } from 'flickr-sdk';

const REQUIRED_VARS = [
  'FLICKR_API_KEY',
  'FLICKR_API_SECRET',
  'FLICKR_OAUTH_TOKEN',
  'FLICKR_OAUTH_TOKEN_SECRET',
];

export function createFlickrClient() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  return createFlickr({
    consumerKey: process.env.FLICKR_API_KEY,
    consumerSecret: process.env.FLICKR_API_SECRET,
    oauthToken: process.env.FLICKR_OAUTH_TOKEN,
    oauthTokenSecret: process.env.FLICKR_OAUTH_TOKEN_SECRET,
  });
}

export function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function text(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && '_content' in field) return field._content ?? '';
  return String(field);
}

function toIso(unixSeconds) {
  if (!unixSeconds) return null;
  const ms = Number(unixSeconds) * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Flickr returns date_taken as "YYYY-MM-DD HH:MM:SS" with no timezone — preserve as ISO-like.
function toIsoFromDateTaken(s) {
  if (!s || typeof s !== 'string') return null;
  return s.replace(' ', 'T');
}

export function normalizeAlbum(set) {
  const photoCount = Number(set?.photos);
  const videoCount = Number(set?.videos);
  return {
    id: set.id,
    title: text(set.title),
    description: text(set.description),
    photoCount: Number.isFinite(photoCount) ? photoCount : null,
    videoCount: Number.isFinite(videoCount) ? videoCount : null,
    primaryPhotoId: set?.primary ?? null,
    dateCreated: toIso(set?.date_create),
    dateUpdated: toIso(set?.date_update),
  };
}

export async function fetchPhotosets(flickr, perPage = 500) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await flickr('flickr.photosets.getList', {
      page: String(page),
      per_page: String(perPage),
    });
    all.push(...asArray(res?.photosets?.photoset));
    const totalPages = Number(res?.photosets?.pages ?? 1);
    if (page >= totalPages) break;
    page += 1;
  }
  return all;
}

export function collectAlbumsFromTree(tree, photosets) {
  const setById = new Map(photosets.map((s) => [s.id, s]));
  const out = [];
  const seen = new Set();
  function walk(cols) {
    for (const col of cols) {
      for (const album of asArray(col.set)) {
        if (seen.has(album.id)) continue;
        seen.add(album.id);
        const meta = setById.get(album.id);
        if (!meta) continue;
        out.push(normalizeAlbum(meta));
      }
      walk(asArray(col.collection));
    }
  }
  walk(asArray(tree?.collections?.collection));
  return out;
}

function sizedFromExtras(photo, suffix) {
  const url = photo?.[`url_${suffix}`];
  if (!url) return null;
  const w = photo?.[`width_${suffix}`];
  const h = photo?.[`height_${suffix}`];
  return {
    url,
    width: w != null ? Number(w) : null,
    height: h != null ? Number(h) : null,
  };
}

export function normalizePhoto(photo) {
  return {
    id: photo.id,
    title: text(photo.title),
    description: text(photo.description),
    dateTaken: toIsoFromDateTaken(photo?.datetaken),
    dateUploaded: toIso(photo?.dateupload),
    sizes: {
      small: sizedFromExtras(photo, 's'),
      medium: sizedFromExtras(photo, 'm'),
      original: sizedFromExtras(photo, 'o'),
    },
    originalFormat: photo?.originalformat ?? null,
    media: photo?.media ?? 'photo',
  };
}

const PHOTO_EXTRAS = 'description,date_taken,date_upload,url_s,url_m,url_o,original_format,media';

export async function fetchPhotosInAlbum(flickr, albumId, perPage = 500) {
  const all = [];
  let page = 1;
  while (true) {
    const res = await flickr('flickr.photosets.getPhotos', {
      photoset_id: albumId,
      page: String(page),
      per_page: String(perPage),
      extras: PHOTO_EXTRAS,
    });
    all.push(...asArray(res?.photoset?.photo));
    const totalPages = Number(res?.photoset?.pages ?? 1);
    if (page >= totalPages) break;
    page += 1;
  }
  return all;
}
