import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
  plugins: [
    {
      name: 'shader',
      transform(src, id) {
        if (id.endsWith('.glsl') || id.endsWith('.wgsl')) {
          return { code: `export default ${JSON.stringify(src)}` };
        }
      },
    },
  ],
});
