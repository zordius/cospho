const DEFAULTS = {
  width: 390,
  densities: [1, 2],
  placeholder: 'none', // 'none' | 'pixelated' | 'blur'
  title: 'Gallery',
  eagerCount: 2,
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
    .replace(/"/g, '&quot;');
}

function pickAspect(p) {
  for (const k of ['o', 'k', 'h', 'l', 'c', 'z', 'm', 'n', 's']) {
    const sz = p.sizes?.[k];
    if (sz?.width && sz?.height) return { w: sz.width, h: sz.height };
  }
  return null;
}

function buildCss(o, totalHeight, sprite, cols, rows) {
  const placeholderBg = sprite
    ? `
.g>div::before{
  content:'';
  position:absolute;
  inset:0;
  background-image:url(${sprite.url});
  background-repeat:no-repeat;
  background-size:calc(${cols}*100vw) calc(${rows}*var(--h)*var(--s)*1px);
  background-position:calc(var(--c)*100vw*-1) calc(var(--r)*var(--h)*var(--s)*-1px);
  ${o.placeholder === 'blur' ? 'filter:blur(8px);' : ''}
  ${o.placeholder === 'pixelated' ? 'image-rendering:pixelated;' : ''}
}`
    : '';

  return `
*{margin:0;padding:0;box-sizing:border-box}
:root{--s:calc(100vw / ${o.width}px)}
body{
  background:#000;
  overscroll-behavior-y:contain;
  touch-action:pan-y;
  font-family:-apple-system,BlinkMacSystemFont,sans-serif;
}
h1{
  color:#fff;
  padding:16px;
  font-size:18px;
  font-weight:400;
}
.g{
  position:relative;
  width:100vw;
  height:calc(${totalHeight}*var(--s)*1px);
}
.g>div{
  position:absolute;
  left:0;
  width:100vw;
  top:calc(var(--y)*var(--s)*1px);
  height:calc(var(--h)*var(--s)*1px);
  overflow:hidden;
  content-visibility:auto;
  contain-intrinsic-size:100vw calc(var(--h)*var(--s)*1px);
}${placeholderBg}
.g>div img{
  position:relative;
  z-index:1;
  display:block;
  width:100%;
  height:100%;
}
@media (hover:hover){
  .g>div:hover{outline:1px solid rgba(255,255,255,.2)}
}
`.trim();
}

export function buildHtml(photos, opts = {}) {
  const o = { ...DEFAULTS, ...opts };

  const eligible = [];
  for (const p of photos) {
    if (p.media !== 'photo') continue;
    const picks = o.densities
      .map((d) => ({ d, sz: pickSize(p, o.width * d) }))
      .filter(({ sz }) => sz?.url);
    if (picks.length === 0) continue;
    const aspect = pickAspect(p);
    if (!aspect) continue;
    const h = Math.round((o.width * aspect.h) / aspect.w);
    eligible.push({ photo: p, h, y: 0, picks });
  }

  if (eligible.length === 0) {
    throw new Error('No eligible photos to render');
  }

  let cumY = 0;
  for (const e of eligible) {
    e.y = cumY;
    cumY += e.h;
  }
  const totalHeight = cumY;

  const sprite = o.sprite ?? null;
  const cols = sprite?.cols ?? 0;
  const rows = sprite ? Math.ceil(eligible.length / cols) : 0;

  const placeholders = eligible.map((e, i) => {
    const c = sprite ? i % cols : 0;
    const r = sprite ? Math.floor(i / cols) : 0;
    const baseUrl = e.picks[0].sz.url;
    const srcsetValue =
      e.picks.length > 1 ? e.picks.map(({ d, sz }) => `${sz.url} ${d}x`).join(',') : '';
    const style = sprite ? `--y:${e.y};--h:${e.h};--c:${c};--r:${r}` : `--y:${e.y};--h:${e.h}`;

    if (i < o.eagerCount) {
      const srcsetAttr = srcsetValue ? ` srcset="${srcsetValue}"` : '';
      return `<div style="${style}"><img src="${baseUrl}"${srcsetAttr} decoding="async"></div>`;
    }
    const urls = [...e.picks]
      .sort((a, b) => a.d - b.d)
      .map(({ sz }) => sz.url)
      .join(',');
    return `<div style="${style}"><img data-src="${urls}"></div>`;
  });

  const head = [
    '<meta charset="utf-8">',
    '<meta http-equiv="Cache-Control" content="public, max-age=31536000, immutable">',
    `<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">`,
    `<title>${escapeHtml(o.title)}</title>`,
    '<link rel="preconnect" href="https://live.staticflickr.com" crossorigin>',
    sprite ? `<link rel="preload" as="image" href="${sprite.url}">` : '',
    `<style>${buildCss(o, totalHeight, sprite, cols, rows)}</style>`,
  ]
    .filter(Boolean)
    .join('\n');

  const lazyScript = `<script>
const T='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const p=innerWidth*devicePixelRatio>=${Math.round(o.width * 1.8)}?1:0;
const o=new IntersectionObserver(es=>{for(const e of es){const i=e.target;if(e.isIntersecting){if(!i.src||i.src===T){i.decoding='async';const u=i.dataset.src.split(',');i.src=u[p]||u[0]}}else if(i.src&&i.src!==T){if(i.complete)o.unobserve(i);else i.src=T}}},{rootMargin:'200px 0px'});
for(const i of document.images)if(i.dataset.src&&!i.src)o.observe(i);
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
${head}
</head>
<body>
<h1>${escapeHtml(o.title)}</h1>
<div class="g">
${placeholders.join('\n')}
</div>
${lazyScript}
</body>
</html>
`;
}
