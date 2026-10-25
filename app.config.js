// Extends app.json. PREVIEW_BUILD=1 (scripts/build-preview.mjs) bundles every
// route into one file so the web build can be hosted from a sub-path.
module.exports = ({ config }) => {
  if (process.env.PREVIEW_BUILD !== '1') return config;
  return {
    ...config,
    plugins: config.plugins.map((p) => (p === 'expo-router' ? ['expo-router', { asyncRoutes: { web: false, default: false } }] : p)),
  };
};
