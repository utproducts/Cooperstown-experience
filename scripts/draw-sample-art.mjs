// Draws the demo's sample site map and background art as PNGs (assets/images/sample-*.png) from
// src/data/sample-venue.json, so the demo's pins line up with the drawing. Real venues upload their own map and
// photos in the Staff view. Run: node scripts/draw-sample-art.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';

// Playwright is installed globally in this environment, not as a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');

const venue = JSON.parse(fs.readFileSync(new URL('../src/data/sample-venue.json', import.meta.url), 'utf8'));
const W = 1600, H = 1100;
const at = (p) => [p.x * W, p.y * H];
const by = (kind) => venue.places.filter((p) => p.kind === kind);

// Deterministic pseudo-random for trees.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function field(p) {
  const [x, y] = at(p);
  const r = 62;
  return `<g transform="translate(${x} ${y})">
    <path d="M0 ${r * 0.55} L${-r} ${-r * 0.5} A${r * 1.15} ${r * 1.15} 0 0 1 ${r} ${-r * 0.5} Z" fill="#5BA34A" stroke="#F4F1E6" stroke-width="3"/>
    <path d="M0 ${r * 0.55} L${-r * 0.42} ${r * 0.12} L0 ${-r * 0.3} L${r * 0.42} ${r * 0.12} Z" fill="#C99B6A"/>
    <circle cx="0" cy="${r * 0.02}" r="5" fill="#E7D3B5"/>
    <text x="0" y="${-r * 0.75}" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#0E2340">${p.name.replace('Field ', '')}</text>
  </g>`;
}
function lot(p, w = 210, h = 120) {
  const [x, y] = at(p);
  const lines = Array.from({ length: 9 }, (_, i) => `<line x1="${-w / 2 + 16 + i * ((w - 32) / 8)}" y1="${-h / 2 + 12}" x2="${-w / 2 + 16 + i * ((w - 32) / 8)}" y2="${-h / 2 + 46}" stroke="#E9E9E9" stroke-width="2"/>
    <line x1="${-w / 2 + 16 + i * ((w - 32) / 8)}" y1="${h / 2 - 46}" x2="${-w / 2 + 16 + i * ((w - 32) / 8)}" y2="${h / 2 - 12}" stroke="#E9E9E9" stroke-width="2"/>`).join('');
  return `<g transform="translate(${x} ${y})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="14" fill="#8C939C"/>${lines}
    <circle cx="${w / 2 - 22}" cy="${-h / 2 + 22}" r="16" fill="#1F5FBF"/><text x="${w / 2 - 22}" y="${-h / 2 + 29}" text-anchor="middle" font-family="Arial" font-weight="800" font-size="20" fill="#fff">P</text></g>`;
}
function bunkRow(p) {
  const [x, y] = at(p);
  return `<g transform="translate(${x - 70} ${y - 45})">${Array.from({ length: 12 }, (_, i) => `<rect x="${(i % 6) * 24}" y="${Math.floor(i / 6) * 48}" width="19" height="34" rx="3" fill="#8B5E3C" stroke="#5E3B22" stroke-width="2"/>`).join('')}</g>`;
}
function building(p, w = 70, h = 46, color = '#B8433A') {
  const [x, y] = at(p);
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${color}" stroke="#7A2620" stroke-width="2"/>`;
}

const trees = Array.from({ length: 140 }, () => {
  const x = rnd() * W, y = rnd() * H;
  const near = venue.places.some((p) => Math.hypot(p.x * W - x, p.y * H - y) < 90);
  return near ? '' : `<circle cx="${x}" cy="${y}" r="${10 + rnd() * 12}" fill="#2F6B34" opacity="0.85"/>`;
}).join('');
const trolleyStops = by('trolley').map(at);
const loop = [...trolleyStops, trolleyStops[0]].map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

const map = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FB069"/><stop offset="1" stop-color="#A7C957"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${[0.25, 0.45, 0.65].map((r) => `<ellipse cx="${W * 0.55}" cy="${H * 0.05}" rx="${W * r}" ry="${H * r * 0.7}" fill="none" stroke="#6E9E5A" stroke-width="3" opacity="0.6"/>`).join('')}
  ${trees}
  <path d="M0 ${H * 0.95} C ${W * 0.2} ${H * 0.9}, ${W * 0.3} ${H * 0.8}, ${W * 0.45} ${H * 0.72} S ${W * 0.6} ${H * 0.55}, ${W * 0.55} ${H * 0.25} S ${W * 0.7} ${H * 0.2}, ${W} ${H * 0.25}" fill="none" stroke="#D9D2BF" stroke-width="26" stroke-linecap="round"/>
  <path d="${loop}" fill="none" stroke="#C9A227" stroke-width="7" stroke-dasharray="18 12" stroke-linecap="round" opacity="0.9"/>
  ${by('parking').map((p, i) => lot(p, i === 2 ? 180 : 230, 120)).join('')}
  ${by('field').map(field).join('')}
  ${by('bunkhouse').map(bunkRow).join('')}
  ${by('restaurant').map((p) => building(p, 96, 58, '#0E2340')).join('')}
  ${[...by('food'), ...by('info')].map((p) => building(p, 74, 46)).join('')}
  ${by('vendor').map((p) => building(p, 48, 34, '#E07A1F')).join('')}
  ${by('checkin').map((p) => building(p, 86, 52, '#F4F1E6')).join('')}
  <g transform="translate(${W - 330} 24)"><rect width="306" height="56" rx="12" fill="#0E2340" opacity="0.9"/>
    <text x="153" y="36" text-anchor="middle" font-family="Arial" font-weight="800" font-size="22" fill="#F4F1E6" letter-spacing="2">SAMPLE SITE MAP</text></g>
  <g transform="translate(24 24)"><rect width="250" height="44" rx="10" fill="#F4F1E6" opacity="0.92"/>
    <line x1="16" y1="22" x2="66" y2="22" stroke="#C9A227" stroke-width="7" stroke-dasharray="14 9"/><text x="80" y="29" font-family="Arial" font-size="18" font-weight="700" fill="#0E2340">Trolley loop</text></g>
</svg>`;

const dusk = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1B33"/><stop offset="0.55" stop-color="#27406B"/><stop offset="0.85" stop-color="#E9895B"/><stop offset="1" stop-color="#F4C27A"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF6D6" stop-opacity="0.9"/><stop offset="1" stop-color="#FFF6D6" stop-opacity="0"/></radialGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E6B3A"/><stop offset="1" stop-color="#173D22"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  ${Array.from({ length: 70 }, () => `<circle cx="${rnd() * 1600}" cy="${rnd() * 380}" r="${rnd() * 1.8 + 0.4}" fill="#fff" opacity="${0.4 + rnd() * 0.6}"/>`).join('')}
  <path d="M0 610 C 300 560, 500 600, 800 570 S 1300 540, 1600 590 L1600 900 L0 900 Z" fill="#1B2E3F"/>
  ${[220, 560, 1040, 1380].map((x) => `<g><rect x="${x - 5}" y="330" width="10" height="290" fill="#1B2430"/><rect x="${x - 46}" y="300" width="92" height="42" rx="4" fill="#2A3442"/>${[0, 1, 2, 3].map((i) => `<circle cx="${x - 33 + i * 22}" cy="321" r="8" fill="#FFF6D6"/>`).join('')}<circle cx="${x}" cy="321" r="150" fill="url(#glow)" opacity="0.55"/></g>`).join('')}
  <path d="M0 700 C 400 650, 1200 650, 1600 700 L1600 900 L0 900 Z" fill="url(#grass)"/>
  <path d="M800 880 L560 760 L800 650 L1040 760 Z" fill="#A87A4F" opacity="0.95"/>
  <path d="M800 840 L640 762 L800 690 L960 762 Z" fill="#3E7D45"/>
  <circle cx="800" cy="765" r="22" fill="#B98B5E"/>
  ${[[800, 873], [560, 760], [800, 652], [1040, 760]].map(([x, y]) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="#F4F1E6" transform="rotate(45 ${x} ${y})"/>`).join('')}
</svg>`;

const diamond = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E2340"/><stop offset="1" stop-color="#1D3A66"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#d)"/>
  ${Array.from({ length: 12 }, (_, i) => `<path d="M${-200 + i * 160} 900 L${200 + i * 160} 0" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="60"/>`).join('')}
  <g transform="translate(1180 470) rotate(-12)" opacity="0.9">
    <circle r="240" fill="#F4F1E6"/>
    <path d="M-170 -170 C -60 -60, -60 60, -170 170" fill="none" stroke="#C8102E" stroke-width="10" stroke-dasharray="2 22" stroke-linecap="round"/>
    <path d="M170 -170 C 60 -60, 60 60, 170 170" fill="none" stroke="#C8102E" stroke-width="10" stroke-dasharray="2 22" stroke-linecap="round"/>
    <path d="M-170 -170 C -60 -60, -60 60, -170 170" fill="none" stroke="#C8102E" stroke-width="3"/>
    <path d="M170 -170 C 60 -60, 60 60, 170 170" fill="none" stroke="#C8102E" stroke-width="3"/>
  </g>
</svg>`;

const out = new URL('../assets/images/', import.meta.url);
const browser = await chromium.launch();
for (const [name, svg, w, h] of [['sample-site-map', map, W, H], ['sample-hero-dusk', dusk, 1600, 900], ['sample-hero-ball', diamond, 1600, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  fs.writeFileSync(new URL(`${name}.png`, out), await page.screenshot({ type: 'png' }));
  await page.close();
  console.log('wrote', name);
}
await browser.close();
