// Extends app.json.
// - PREVIEW_BUILD=1 (scripts/build-preview.mjs) bundles every route into one file so the web build can be hosted from
//   any sub-path.
// - EXPO_BASE_URL=/Cooperstown-experience builds the web app for a fixed sub-path (GitHub Pages).
module.exports = ({ config }) => {
  let out = config;
  if (process.env.PREVIEW_BUILD === '1') {
    out = {
      ...out,
      plugins: out.plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: { web: false, default: false } }] : p)),
    };
  }
  if (process.env.EXPO_BASE_URL) {
    out = { ...out, experiments: { ...out.experiments, baseUrl: process.env.EXPO_BASE_URL } };
  }
  return out;
};
