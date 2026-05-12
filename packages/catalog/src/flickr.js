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

// Flickr size suffixes: sq=75² q=150² t=100 s=240 n=320 m=500 z=640 c=800
// l=1024 h=1600 k=2048 3k=3072 4k=4096 f=6144(panorama) 5k=5120 6k=6144 o=original
const SIZE_KEYS = [
  'sq',
  'q',
  't',
  's',
  'n',
  'm',
  'z',
  'c',
  'l',
  'h',
  'k',
  '3k',
  '4k',
  'f',
  '5k',
  '6k',
  'o',
];

export function normalizePhoto(photo) {
  const sizes = {};
  for (const k of SIZE_KEYS) {
    sizes[k] = sizedFromExtras(photo, k);
  }
  return {
    id: photo.id,
    title: text(photo.title),
    description: text(photo.description),
    dateTaken: toIsoFromDateTaken(photo?.datetaken),
    dateUploaded: toIso(photo?.dateupload),
    sizes,
    originalFormat: photo?.originalformat ?? null,
    media: photo?.media ?? 'photo',
  };
}

const PHOTO_EXTRAS = [
  'description',
  'date_taken',
  'date_upload',
  'original_format',
  'media',
  ...SIZE_KEYS.map((k) => `url_${k}`),
].join(',');

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

// Flickr's getExif returns Orientation as ExifTool's descriptive string
// rather than the numeric EXIF code (1–8). Map it back so callers get a
// usable code.
const ORIENTATION_BY_LABEL = {
  'Horizontal (normal)': 1,
  'Mirror horizontal': 2,
  'Rotate 180': 3,
  'Mirror vertical': 4,
  'Mirror horizontal and rotate 270 CW': 5,
  'Rotate 90 CW': 6,
  'Mirror horizontal and rotate 90 CW': 7,
  'Rotate 270 CW': 8,
};

export async function fetchPhotoExifOrientation(flickr, photoId) {
  const res = await flickr('flickr.photos.getExif', { photo_id: String(photoId) });
  const tags = asArray(res?.photo?.exif);
  const tag = tags.find((t) => t.tag === 'Orientation');
  const raw = tag?.raw?._content;
  if (!raw) return undefined;
  return ORIENTATION_BY_LABEL[raw];
}

// Returns an async gate that paces callers at most one start per
// `minIntervalMs`. Flickr publishes 3600 queries/hour (~1/sec); going over
// returns 503 Server temporarily unavailable.
export function createRateLimiter(minIntervalMs) {
  let next = 0;
  return async () => {
    const now = Date.now();
    const slot = Math.max(next, now);
    next = slot + minIntervalMs;
    const wait = slot - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

export function attachOrientation(photo, orientation) {
  if (orientation == null) return photo;
  return { ...photo, orientation };
}
