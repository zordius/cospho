import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { listCachedAlbums, getPrimaryPhoto, getDocsDir } from '../src/index.js';

const VERSION = 'v1';
const OUT_DIR = getDocsDir();
const OUT_FILE = resolve(OUT_DIR, 'index.html');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const cachedAlbums = await listCachedAlbums(VERSION);

if (cachedAlbums.length === 0) {
  console.error('No cached albums found. Run list-photos for at least one album first.');
  process.exit(1);
}

const items = await Promise.all(
  cachedAlbums.map(async (a) => {
    const cover = await getPrimaryPhoto(VERSION, a.id);
    const url = cover?.sizes?.m?.url || cover?.sizes?.s?.url || '';
    return { id: a.id, title: a.title, photoCount: a.photoCount, url };
  }),
);

const tiles = items
  .map(
    (i) =>
      `<a href="albums/${i.id}.html"><img src="${i.url}" loading="lazy" decoding="async"><div class="t">${escapeHtml(i.title)}</div></a>`,
  )
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Cospho</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
h1{padding:16px;font-size:18px;font-weight:400}
.list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:8px}
.list a{display:block;text-decoration:none;color:inherit}
.list a img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.list a .t{padding:8px;font-size:14px}
</style>
</head>
<body>
<h1>Cospho — ${cachedAlbums.length} albums</h1>
<div class="list">
${tiles}
</div>
</body>
</html>
`;

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, html);
console.log(`Index: ${relative(process.cwd(), OUT_FILE)}`);
