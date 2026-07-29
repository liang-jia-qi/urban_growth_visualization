import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites at <user>.github.io/<repo-name>/,
  // so production asset URLs need that prefix. Dev server stays at "/".
  base: command === 'build' ? '/urban_growth_visualization/' : '/',
  plugins: [react()],
}))
