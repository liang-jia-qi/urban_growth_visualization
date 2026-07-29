// Vite's `base` config (set to "/urban_growth_visualization/" in production
// builds for GitHub Pages) only rewrites bundler-processed asset URLs, not
// hardcoded strings passed to fetch/d3.csv/img src. This helper prefixes
// requests for files under public/data/ with the real base URL so they
// resolve correctly both in dev ("/") and once deployed under a subpath.
export function dataUrl(path) {
  return `${import.meta.env.BASE_URL}data/${path}`;
}
