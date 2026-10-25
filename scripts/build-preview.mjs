// Builds a self-contained web preview that runs from any sub-path (e.g. a
// claude.ai artifact page): one JS bundle, no "_"-prefixed paths, asset URLs
// resolved against the page's own location at runtime.
//
//   node scripts/build-preview.mjs [outDir]     (default: dist-preview)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'dist-preview');
const tmp = `${out}-export`;
fs.rmSync(tmp, { recursive: true, force: true });
fs.rmSync(out, { recursive: true, force: true });
execSync(`npx expo export -p web --output-dir "${tmp}"`, { stdio: 'inherit', env: { ...process.env, PREVIEW_BUILD: '1' } });

const jsDir = path.join(tmp, '_expo/static/js/web');
const scripts = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').match(/<script src="\/_expo\/static\/js\/web\/[^"]+"/g) ?? [];
const names = scripts.map((s) => s.slice(s.lastIndexOf('/') + 1, -1));
// Routes are bundled together; the only lazy chunks left are library polyfills (e.g. the QR scanner's).
const chunks = fs.readdirSync(jsDir);
if (chunks.length > names.length + 3) throw new Error(`found ${chunks.length} chunks: async routes still on?`);

fs.mkdirSync(path.join(out, 'js'), { recursive: true });
for (const name of chunks) {
  // Asset and chunk paths are absolute ("/assets/...", "/_expo/..."); resolve them against the page's base URL instead.
  const code = fs
    .readFileSync(path.join(jsDir, name), 'utf8')
    .replace(/"\/assets\//g, '(window.__CXP_BASE||"/")+"assets/')
    .replace(/"\/_expo\/static\/js\/web\/_*/g, '(window.__CXP_BASE||"/")+"js/');
  fs.writeFileSync(path.join(out, 'js', name.replace(/^_+/, '')), code);
}
fs.cpSync(path.join(tmp, 'assets'), path.join(out, 'assets'), { recursive: true });

const reset = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').match(/<style id="expo-reset">[\s\S]*?<\/style>/)[0];
fs.writeFileSync(
  path.join(out, 'index.html'),
  `<title>Cooperstown Experience</title>
<meta name="theme-color" content="#0E2340">
${reset}
<style>
  /* The host pads the page for phone safe areas; keep that padding inside the
     100% height so the app fills exactly one screen instead of scrolling the page. */
  html { box-sizing: border-box; background: #F7F2E8; }
  body { background: #F7F2E8; }
</style>
<div id="root"></div>
${names.map((n) => `<script src="js/${n.replace(/^_+/, '')}" defer></script>`).join('\n')}
<script>
  // Runs before the deferred bundle: remember where the files live, then start the
  // router at "/" (the host serves this page from a sub-path). The script tags above
  // already resolved their URLs.
  window.__CXP_BASE = new URL('.', location.href).href;
  try { history.replaceState(null, '', '/'); } catch (e) {}
</script>
`,
);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`preview written to ${out}`);
