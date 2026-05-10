const DEFAULTS = {
  width: 390,
  densities: [1, 2],
  placeholder: 'none', // 'none' | 'pixelated'
  title: 'Gallery',
  eagerRows: 4,
  gap: 4,
  hgap: null, // horizontal gap inside paired rows; falls back to gap
  pair: true, // auto-pair non-wide photos; wide photos stay solo
  soloAspectMin: 1.2, // photo with w/h >= this counts as wide
  forceSoloAspectMin: 1.4, // photo with w/h > this always goes solo, never pairs
  alwaysShowTitle: false,
  linkUrl: null, // (photo) => string  — when set, click navigates to result
  faviconBase: '../',
  beforeG: '',
  afterG: '',
};

// Flickr sizes in ascending long-side order. Square crops (sq, q) excluded
// because they discard content; we need preserved aspect for the column layout.
const ORDERED_SIZES = [
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

function pickSize(photo, targetWidth) {
  let largest = null;
  for (const k of ORDERED_SIZES) {
    const sz = photo.sizes?.[k];
    if (!sz?.url) continue;
    largest = sz;
    if (sz.width != null && sz.width >= targetWidth) return sz;
  }
  return largest;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pickAspect(p) {
  for (const k of ['o', 'k', 'h', 'l', 'c', 'z', 'm', 'n', 's']) {
    const sz = p.sizes?.[k];
    if (sz?.width && sz?.height) return { w: sz.width, h: sz.height };
  }
  return null;
}

function packRow(items, containerW, hgap) {
  if (items.length === 1) {
    const { aspect } = items[0];
    const h = Math.round((containerW * aspect.h) / aspect.w);
    return [{ ...items[0], x: 0, w: containerW, h }];
  }
  const aspects = items.map((it) => it.aspect.w / it.aspect.h);
  const sumA = aspects.reduce((s, a) => s + a, 0);
  const h = Math.round((containerW - hgap * (items.length - 1)) / sumA);
  const out = [];
  let x = 0;
  for (let i = 0; i < items.length; i += 1) {
    const isLast = i === items.length - 1;
    const w = isLast ? containerW - x : Math.round(h * aspects[i]);
    out.push({ ...items[i], x, w, h });
    x += w + hgap;
  }
  return out;
}

function buildCss(o, totalHeight, sprite, cols, rows) {
  const isPixelated = o.placeholder === 'pixelated';
  const spriteRules = sprite
    ? `
  background-image:url(${sprite.url});
  background-repeat:no-repeat;
  background-size:calc(${cols}*var(--w)*var(--s)*1px) calc(${rows}*var(--h)*var(--s)*1px);
  background-position:calc(var(--c)*var(--w)*var(--s)*-1px) calc(var(--r)*var(--h)*var(--s)*-1px);${isPixelated ? '\n  image-rendering:pixelated;' : ''}`
    : `
  background:#888;`;

  return `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--s:calc(100vw / ${o.width}px)}
body{
  background:#000;
  color:#fff;
  overscroll-behavior-y:contain;
  touch-action:pan-y;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
h1{
  padding:16px;
  font-size:18px;
  font-weight:400;
}
p{
  padding:0 16px 16px;
}
.g{
  position:relative;
  width:100vw;
  height:calc(${totalHeight}*var(--s)*1px);
}
.g>div{
  position:absolute;
  left:calc(var(--x)*var(--s)*1px);
  width:calc(var(--w)*var(--s)*1px);
  top:calc(var(--y)*var(--s)*1px);
  height:calc(var(--h)*var(--s)*1px);
  overflow:hidden;
  content-visibility:auto;
  contain-intrinsic-size:calc(var(--w)*var(--s)*1px) calc(var(--h)*var(--s)*1px);
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;${spriteRules}
}
.g>div img{
  display:block;
  width:100%;
  height:100%;
  pointer-events:none;${isPixelated ? '\n  image-rendering:auto;' : ''}
}
.g>div[data-t]::after{
  content:attr(data-t);
  position:absolute;
  left:16px;
  top:16px;
  z-index:2;
  padding:6px 10px;
  max-width:calc(100% - 32px);
  overflow-wrap:break-word;
  background:rgba(0,0,0,.8);
  font-size:14px;
  border-radius:4px;
  pointer-events:none;
  opacity:${o.alwaysShowTitle ? 1 : 0};${o.alwaysShowTitle ? '' : '\n  transition:opacity .5s;'}
}${o.alwaysShowTitle ? '' : `\n.g>div[data-t].s::after{opacity:1;transition:opacity 0s}`}
@media (hover:hover){
  .g>div:hover{outline:1px solid rgba(255,255,255,.2)}
}
`.trim();
}

export function buildHtml(photos, opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const items = [];
  for (const p of photos) {
    if (p.media !== 'photo') continue;
    const aspect = pickAspect(p);
    if (!aspect) continue;
    if (!pickSize(p, 1)) continue;
    items.push({ photo: p, aspect });
  }

  if (items.length === 0) {
    throw new Error('No eligible photos to render');
  }

  const hgap = o.hgap ?? o.gap;
  const aspectOf = (it) => it.aspect.w / it.aspect.h;
  const isWide = (it) => aspectOf(it) >= o.soloAspectMin;
  const isForceSolo = (it) => aspectOf(it) > o.forceSoloAspectMin;

  const rows = [];
  let i = 0;
  while (i < items.length) {
    const a = items[i];
    if (!o.pair || i + 1 >= items.length || isForceSolo(a)) {
      rows.push([a]);
      i += 1;
      continue;
    }
    const b = items[i + 1];
    if (isForceSolo(b) || (isWide(a) && isWide(b))) {
      rows.push([a]);
      i += 1;
    } else {
      rows.push([a, b]);
      i += 2;
    }
  }

  const eligible = [];
  let cumY = 0;
  for (let r = 0; r < rows.length; r += 1) {
    const placed = packRow(rows[r], o.width, hgap);
    if (r > 0) cumY += o.gap;
    for (const cell of placed) {
      cell.picks = o.densities
        .map((d) => ({ d, sz: pickSize(cell.photo, cell.w * d) }))
        .filter(({ sz }) => sz?.url);
      eligible.push({ ...cell, y: cumY, rowIdx: r });
    }
    cumY += placed[0].h;
  }
  const totalHeight = cumY;

  const sprite = o.sprite ?? null;
  const cols = sprite?.cols ?? 0;
  const spriteRows = sprite ? Math.ceil(eligible.length / cols) : 0;

  const placeholders = eligible.map((e, i) => {
    const c = sprite ? i % cols : 0;
    const r = sprite ? Math.floor(i / cols) : 0;
    const baseUrl = e.picks[0].sz.url;
    const srcsetValue =
      e.picks.length > 1 ? e.picks.map(({ d, sz }) => `${sz.url} ${d}x`).join(',') : '';
    const base = `--x:${e.x};--y:${e.y};--w:${e.w};--h:${e.h}`;
    const style = sprite ? `${base};--c:${c};--r:${r}` : base;
    const titleAttr = e.photo.title ? ` data-t="${escapeHtml(e.photo.title)}"` : '';
    const url = o.linkUrl ? o.linkUrl(e.photo) : null;
    const linkAttr = url ? ` data-h="${escapeHtml(url)}"` : '';

    if (e.rowIdx < o.eagerRows) {
      const srcsetAttr = srcsetValue ? ` srcset="${srcsetValue}"` : '';
      return `<div${titleAttr}${linkAttr} style="${style}"><img src="${baseUrl}"${srcsetAttr} decoding="async"></div>`;
    }
    const urls = [...e.picks]
      .sort((a, b) => a.d - b.d)
      .map(({ sz }) => sz.url)
      .join(',');
    return `<div${titleAttr}${linkAttr} style="${style}"><img data-src="${urls}"></div>`;
  });

  const head = [
    '<meta charset="utf-8">',
    '<meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">',
    `<link rel="icon" type="image/png" sizes="32x32" href="${o.faviconBase}favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${o.faviconBase}favicon-16x16.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${o.faviconBase}apple-touch-icon.png">`,
    `<link rel="manifest" href="${o.faviconBase}site.webmanifest">`,
    `<link rel="shortcut icon" href="${o.faviconBase}favicon.ico">`,
    '<meta name="theme-color" content="#000000">',
    `<title>${escapeHtml(o.title)}</title>`,
    '<link rel="preconnect" href="https://live.staticflickr.com" crossorigin>',
    sprite ? `<link rel="preload" as="image" href="${sprite.url}">` : '',
    `<style>${buildCss(o, totalHeight, sprite, cols, spriteRows)}</style>`,
  ]
    .filter(Boolean)
    .join('\n');

  const lazyScript = `<script>
const T='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const p=innerWidth*devicePixelRatio>=${Math.round(o.width * 1.8)}?1:0;
const o=new IntersectionObserver(es=>{for(const e of es){const i=e.target;if(e.isIntersecting){if(!i.src||i.src===T){i.decoding='async';const u=i.dataset.src.split(',');i.src=u[p]||u[0]}}else if(i.src&&i.src!==T){if(i.complete)o.unobserve(i);else i.src=T}}},{rootMargin:'200px 0px'});
for(const i of document.images)if(i.dataset.src&&!i.src)o.observe(i);
${o.linkUrl ? `document.querySelector('.g').addEventListener('click',e=>{const d=e.target.closest('div[data-h]');if(!d)return;location=d.dataset.h});` : `document.querySelector('.g').addEventListener('click',e=>{const d=e.target.closest('div[data-t]');if(!d)return;d.scrollIntoView({behavior:'smooth',block:'start'});clearTimeout(d._t);d.classList.add('s');d._t=setTimeout(()=>d.classList.remove('s'),3000)});`}
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head}
</head>
<body>
<h1>${escapeHtml(o.title)}</h1>
${o.beforeG}
<div class="g">
${placeholders.join('\n')}
</div>
${o.afterG}
${lazyScript}
</body>
</html>
`;
}
