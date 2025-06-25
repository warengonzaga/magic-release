import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  external: ['react'],
  esbuildOptions(options) {
    options.conditions = ['module'];
    options.jsx = 'automatic';
  },
});
