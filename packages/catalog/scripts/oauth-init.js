import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createFlickr } from 'flickr-sdk';

const consumerKey = process.env.FLICKR_API_KEY;
const consumerSecret = process.env.FLICKR_API_SECRET;

if (!consumerKey || !consumerSecret) {
  console.error('Missing FLICKR_API_KEY or FLICKR_API_SECRET in environment.');
  console.error('Set them in .env at the monorepo root, then run again.');
  process.exit(1);
}

const { oauth } = createFlickr({
  consumerKey,
  consumerSecret,
  oauthToken: false,
  oauthTokenSecret: false,
});

console.log('Requesting OAuth request token from Flickr...');
const { requestToken, requestTokenSecret } = await oauth.request('oob');

const authorizeUrl = oauth.authorizeUrl(requestToken, 'write');
console.log('\nOpen this URL in your browser, sign in, and authorize the app:\n');
console.log(`  ${authorizeUrl}\n`);
console.log('Flickr will display a 9-digit verifier code.\n');

const rl = createInterface({ input, output });
const verifier = (await rl.question('Paste verifier here: ')).trim();
rl.close();

if (!verifier) {
  console.error('No verifier entered. Aborting.');
  process.exit(1);
}

const { oauth: oauthWithRequestToken } = createFlickr({
  consumerKey,
  consumerSecret,
  oauthToken: requestToken,
  oauthTokenSecret: requestTokenSecret,
});

let result;
try {
  result = await oauthWithRequestToken.verify(verifier);
} catch (err) {
  console.error(
    '\nVerification failed. Common causes: wrong code, expired token, or revoked authorization.',
  );
  console.error(err?.message ?? err);
  process.exit(1);
}

console.log(`\nAuthorized as ${result.fullname} (@${result.username}, nsid=${result.nsid})\n`);
console.log('Add these lines to .env at the monorepo root:\n');
console.log(`FLICKR_OAUTH_TOKEN=${result.oauthToken}`);
console.log(`FLICKR_OAUTH_TOKEN_SECRET=${result.oauthTokenSecret}`);
