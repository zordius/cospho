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
  forceSoloAspectMin: 1.52, // photo with w/h > this always goes solo, never pairs
  alwaysShowTitle: false,
  linkUrl: null, // (photo) => string  — when set, click navigates to result
  faviconBase: '../',
  beforeG: '',
  afterG: '',
  // Optional sticky-header sections. Array of { at, title } sorted by `at`.
  // `at` indexes into the `photos` argument; the photo at that index begins a
  // new group with `title` rendered as a sticky header above. Pair packing
  // restarts at each boundary, so a pair never spans two groups.
  sections: null,
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
    if (largest == null || sz.width > largest.width) largest = sz;
    if (sz.width != null && sz.width >= targetWidth) return sz;
  }
  return largest;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Longest URL prefix common to every photo's every size. Used to factor a
// shared host/path out of `data-src` attributes; returned empty when there is
// no useful common prefix (or fewer than ~10 chars saved per URL).
function computeLazyUrlPrefix(photos) {
  let prefix = null;
  for (const p of photos) {
    if (p.media !== 'photo') continue;
    for (const sz of Object.values(p.sizes ?? {})) {
      const u = sz?.url;
      if (!u) continue;
      if (prefix === null) {
        prefix = u;
        continue;
      }
      let i = 0;
      const len = Math.min(prefix.length, u.length);
      while (i < len && prefix.charCodeAt(i) === u.charCodeAt(i)) i += 1;
      prefix = prefix.slice(0, i);
      if (prefix.length < 10) return '';
    }
  }
  return prefix && prefix.length >= 10 ? prefix : '';
}

function pickAspect(p) {
  // Flickr pre-rotates derivative sizes but returns `o` ambiguously: raw EXIF
  // dims when a larger pipeline exists, pre-rotated when `o` is the only/last
  // rendition. Prefer derivatives so rotation never matters; fall back to `o`
  // with a swap only when nothing else is available and the photo is rotated.
  for (const k of ['k', 'h', 'l', 'c', 'z', 'm', 'n', 's']) {
    const sz = p.sizes?.[k];
    if (sz?.width && sz?.height) return { w: sz.width, h: sz.height };
  }
  const o = p.sizes?.o;
  if (o?.width && o?.height) {
    const rotated = p.rotation === 90 || p.rotation === 270;
    return rotated ? { w: o.height, h: o.width } : { w: o.width, h: o.height };
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

function buildRows(items, o) {
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
  return rows;
}

function renderCell(e, o, sprite, cols, urlPrefix) {
  const c = sprite ? e.idx % cols : 0;
  const r = sprite ? Math.floor(e.idx / cols) : 0;
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
  const strip = urlPrefix ? urlPrefix.length : 0;
  const urls = [...e.picks]
    .sort((a, b) => a.d - b.d)
    .map(({ sz }) => (strip ? sz.url.slice(strip) : sz.url))
    .join(',');
  return `<div${titleAttr}${linkAttr} style="${style}"><img data-src="${urls}"></div>`;
}

function buildCss(o, sprite, cols, rows) {
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
:root{--ww:${o.width};--s:calc(100vw / (var(--ww) * 1px))}
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
h2{
  position:sticky;
  top:0;
  z-index:3;
  background:#222;
  padding:8px 16px;
  font-size:14px;
  font-weight:400;
}
.g{
  position:relative;
  width:100vw;
  height:calc(var(--gh)*var(--s)*1px);
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
  z-index:0;
  -webkit-tap-highlight-color:transparent;
  scroll-margin-bottom:calc(var(--h)*var(--s)*(var(--ww) - var(--w))/var(--w)*1px);
  transform-origin:0 0;
  transition:transform .3s,z-index 0s .3s;${spriteRules}
}
.g>div.s{
  z-index:100;
  transform:translate(calc(var(--x)*var(--s)*-1px),0) scale(calc(var(--ww)/var(--w)));
  transition:transform .3s,z-index 0s 0s;
}
.g>div img{
  display:block;
  width:100%;
  height:100%;
  pointer-events:none;${isPixelated ? '\n  image-rendering:auto;' : ''}
}
.g>div[data-t]::after{
  content:attr(data-t);
  position:absolute;${o.alwaysShowTitle ? `
  left:0;
  right:0;
  bottom:0;
  z-index:2;
  padding:4px 8px;
  overflow-wrap:break-word;
  background:rgba(0,0,0,.7);
  font-size:14px;
  pointer-events:none;` : `
  left:16px;
  top:16px;
  z-index:2;
  padding:6px 10px;
  max-width:min(calc(100% - 32px), 480px);
  overflow-wrap:break-word;
  background:rgba(0,0,0,.8);
  font-size:14px;
  border-radius:4px;
  pointer-events:none;
  transform-origin:0 0;
  opacity:0;
  transition:opacity .5s,transform .3s,left .3s,top .3s;`}
}${o.alwaysShowTitle ? '' : `
.g>div[data-t].s::after{
  left:calc(16px*var(--w)/var(--ww));
  top:calc(16px*var(--w)/var(--ww));
  max-width:min(calc(100vw - 32px),480px);
  transform:scale(calc(var(--w)/var(--ww)));
  opacity:1;
  transition:opacity 0s,transform .3s,left .3s,top .3s;
}`}
@media (hover:hover){
  .g>div:hover{outline:1px solid rgba(255,255,255,.2)}
}
`.trim();
}

// Build one <div class="g"> block from a slice of photos.
// `offsets.cellIdxOffset` and `offsets.rowIdxOffset` let multi-group callers
// thread global counters so sprite tile lookup and eager-row checks remain
// continuous across blocks. Returns { html, cellCount, rowCount } so the
// caller can advance offsets for the next block.
export function buildGroup(photos, opts = {}, offsets = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { cellIdxOffset = 0, rowIdxOffset = 0 } = offsets;

  const items = [];
  for (const p of photos) {
    if (p.media !== 'photo') continue;
    const aspect = pickAspect(p);
    if (!aspect) continue;
    if (!pickSize(p, 1)) continue;
    items.push({ photo: p, aspect });
  }

  if (items.length === 0) {
    return { html: '', cellCount: 0, rowCount: 0 };
  }

  const hgap = o.hgap ?? o.gap;
  const rows = buildRows(items, o);

  const cells = [];
  let cumY = 0;
  for (let r = 0; r < rows.length; r += 1) {
    const placed = packRow(rows[r], o.width, hgap);
    if (r > 0) cumY += o.gap;
    for (const cell of placed) {
      const seen = new Set();
      cell.picks = o.densities
        .map((d) => ({ d, sz: pickSize(cell.photo, cell.w * d) }))
        .filter(({ sz }) => {
          if (!sz?.url || seen.has(sz.url)) return false;
          seen.add(sz.url);
          return true;
        });
      cells.push({
        ...cell,
        y: cumY,
        rowIdx: rowIdxOffset + r,
        idx: cellIdxOffset + cells.length,
      });
    }
    cumY += placed[0].h;
  }
  const totalHeight = cumY;

  const sprite = o.sprite ?? null;
  const cols = sprite?.cols ?? 0;
  const placeholders = cells.map((e) => renderCell(e, o, sprite, cols, o._urlPrefix));

  return {
    html: `<div class="g" style="--gh:${totalHeight}">\n${placeholders.join('\n')}\n</div>`,
    cellCount: cells.length,
    rowCount: rows.length,
  };
}

export function buildHtml(photos, opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const sectionsIn = (o.sections ?? []).slice().sort((a, b) => a.at - b.at);
  if (sectionsIn.length === 0 || sectionsIn[0].at !== 0) {
    sectionsIn.unshift({ at: 0, title: null });
  }

  const groups = sectionsIn
    .map((s, i) => ({
      title: s.title,
      photos: photos.slice(
        Math.max(0, s.at),
        Math.min(photos.length, sectionsIn[i + 1]?.at ?? photos.length),
      ),
    }))
    .filter((g) => g.photos.length > 0);

  const urlPrefix = computeLazyUrlPrefix(photos);
  const groupOpts = { ...opts, _urlPrefix: urlPrefix };

  let cellOffset = 0;
  let rowOffset = 0;
  const groupParts = [];
  for (const grp of groups) {
    const result = buildGroup(grp.photos, groupOpts, {
      cellIdxOffset: cellOffset,
      rowIdxOffset: rowOffset,
    });
    if (result.cellCount === 0) continue;
    if (grp.title) {
      groupParts.push(
        `<section><h2>${escapeHtml(grp.title)}</h2>\n${result.html}\n</section>`,
      );
    } else {
      groupParts.push(result.html);
    }
    cellOffset += result.cellCount;
    rowOffset += result.rowCount;
  }

  if (cellOffset === 0) {
    throw new Error('No eligible photos to render');
  }

  const sprite = o.sprite ?? null;
  const cols = sprite?.cols ?? 0;
  const spriteRows = sprite ? Math.ceil(cellOffset / cols) : 0;

  const head = [
    '<meta charset="utf-8">',
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
    `<style>${buildCss(o, sprite, cols, spriteRows)}</style>`,
  ]
    .filter(Boolean)
    .join('\n');

  const prefixDecl = urlPrefix ? `const F=${JSON.stringify(urlPrefix)};` : '';
  const setSrc = urlPrefix ? `i.src=F+(u[p]||u[0])` : `i.src=u[p]||u[0]`;
  const lazyScript = `<script>
const T='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
${prefixDecl}const p=innerWidth*devicePixelRatio>=${Math.round(o.width * 1.8)}?1:0;
const o=new IntersectionObserver(es=>{for(const e of es){const i=e.target;if(e.isIntersecting){if(!i.src||i.src===T){i.decoding='async';const u=i.dataset.src.split(',');${setSrc}}}else if(i.src&&i.src!==T){if(i.complete)o.unobserve(i);else i.src=T}}},{rootMargin:'200px 0px'});
for(const i of document.images)if(i.dataset.src&&!i.src)o.observe(i);
${o.linkUrl ? `document.body.addEventListener('click',e=>{const d=e.target.closest('div[data-h]');if(!d)return;location=d.dataset.h});` : `document.body.addEventListener('click',e=>{let d=e.target.closest('.g>div');if(!d)return;if(d.classList.contains('s')){const a=document.querySelectorAll('.g>div');const t=a[[].indexOf.call(a,d)+(e.clientX<innerWidth/2?-1:1)];if(!t)return;clearTimeout(d._t);d.classList.remove('s');d=t}d.scrollIntoView({behavior:'smooth',block:'end'});clearTimeout(d._t);d.classList.add('s');d._t=setTimeout(()=>d.classList.remove('s'),3000)});`}
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head}
</head>
<body>
<h1>${escapeHtml(o.title)}</h1>
${o.beforeG}
${groupParts.join('\n')}
${o.afterG}
${lazyScript}
</body>
</html>
`;
}
