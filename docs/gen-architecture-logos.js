// Regenerates docs/architecture-logos.svg - the box diagram with real
// brand logos (Next.js, Vercel, Neon, Google, Nike as the store example).
//
// This isn't part of the app's own dependency tree (no need for every
// `pnpm install` to pull in an icon pack just to render a doc image), so
// run it from a scratch directory with simple-icons installed there, e.g.:
//   mkdir /tmp/gen-logos && cd /tmp/gen-logos && npm install simple-icons
//   cp /path/to/this/repo/docs/gen-architecture-logos.js .
//   node gen-architecture-logos.js
//   cp architecture-logos.svg /path/to/this/repo/docs/architecture-logos.svg
//
// Edit the box/edge definitions below and re-run to update the diagram.
const path = require('path');
const icons = require('simple-icons');

function iconG(key, x, y, size, color) {
  const i = icons[key];
  const s = size / 24;
  return `<g transform="translate(${x},${y}) scale(${s})"><path d="${i.path}" fill="${color || '#' + i.hex}"/></g>`;
}

// Generic (non-brand) icons, hand-drawn as plain shapes.
function browserIcon(x, y, size, color) {
  const s = size / 24;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="1.6">
    <rect x="1" y="3" width="22" height="18" rx="2"/>
    <line x1="1" y1="8" x2="23" y2="8"/>
    <circle cx="4" cy="5.5" r="0.7" fill="${color}" stroke="none"/>
    <circle cx="6.5" cy="5.5" r="0.7" fill="${color}" stroke="none"/>
    <circle cx="9" cy="5.5" r="0.7" fill="${color}" stroke="none"/>
  </g>`;
}

function scraperIcon(x, y, size, color) {
  const s = size / 24;
  return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="1.8">
    <circle cx="10" cy="10" r="7"/>
    <line x1="15.2" y1="15.2" x2="22" y2="22"/>
    <path d="M7 10 a3 3 0 0 1 3 -3" stroke-linecap="round"/>
  </g>`;
}

const INK = '#1e293b';
const MUTED = '#64748b';
const BOX_FILL = '#f8fafc';
const BOX_STROKE = '#cbd5e1';

function box(x, y, w, h, label, iconSvg, sublabel) {
  const cx = x + w / 2;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${BOX_FILL}" stroke="${BOX_STROKE}" stroke-width="1.5"/>
    ${iconSvg}
    <text x="${cx}" y="${y + h - (sublabel ? 30 : 16)}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15" font-weight="600" fill="${INK}">${label}</text>
    ${sublabel ? `<text x="${cx}" y="${y + h - 12}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" fill="${MUTED}">${sublabel}</text>` : ''}
  </g>`;
}

function arrow(id) {
  return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${MUTED}"/></marker>`;
}

function edge(x1, y1, x2, y2, label, markerId, bidir) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 8;
  return `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${MUTED}" stroke-width="1.5"
    marker-end="url(#${markerId})" ${bidir ? `marker-start="url(#${markerId}-start)"` : ''}/>
  <rect x="${midX - label.length * 3.1 - 6}" y="${midY - 12}" width="${label.length * 6.2 + 12}" height="18" fill="white" opacity="0.9"/>
  <text x="${midX}" y="${midY}" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12.5" fill="${INK}">${label}</text>`;
}

const W = 1360, H = 320;

const browserBox = box(30, 40, 190, 110, 'Browser', browserIcon(30 + 95 - 16, 40 + 14, 32, INK), '(user)');
const cronBox = box(30, 190, 190, 110, 'Vercel Cron', iconG('siVercel', 30 + 95 - 16, 190 + 12, 32, '#000'), 'scheduled trigger');
const appBox = box(300, 150, 260, 150, 'Next.js App', iconG('siNextdotjs', 300 + 130 - 16, 150 + 12, 32, '#000'), '(hosted on Vercel)');
const dbBox = box(680, 20, 240, 110, 'Neon Postgres', iconG('siNeon', 680 + 120 - 16, 20 + 12, 32, '#00e599'), 'TrackedItem / ProductLink / PriceSnapshot');
const scraperBox = box(680, 170, 200, 110, 'Scraper', scraperIcon(680 + 100 - 16, 170 + 12, 32, INK), '(lib/extract)');
const storesBox = box(1000, 170, 330, 110, 'Store websites', iconG('siNike', 1000 + 165 - 16, 170 + 12, 32, '#111'), 'Nike, Footlocker, ...');

const edges = [
  edge(220, 95, 300, 180, 'view dashboard', 'arrow', true),
  edge(220, 245, 300, 260, 'triggers every 6h', 'arrow', false),
  edge(560, 190, 680, 100, 'read / write prices', 'arrow', true),
  edge(560, 230, 680, 225, 'calls', 'arrow', false),
  edge(880, 225, 1000, 225, 'fetches product pages', 'arrow', false),
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif,system-ui,sans-serif">
  <defs>
    ${arrow('arrow')}
    <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6 Z" fill="${MUTED}"/></marker>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
  ${browserBox}
  ${cronBox}
  ${appBox}
  ${dbBox}
  ${scraperBox}
  ${storesBox}
  ${edges.join('\n')}
</svg>`;

const outPath = path.join(process.cwd(), 'architecture-logos.svg');
require('fs').writeFileSync(outPath, svg);
console.log('wrote ' + outPath);
