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
