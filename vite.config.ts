import { defineConfig, type Plugin } from 'vite';

// Make the static build open from file:// too: module scripts and
// crossorigin attributes are blocked there, so emit a classic deferred script.
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ type="module"/g, ' defer').replace(/ crossorigin/g, '');
    },
  };
}

// The demo page lives in demo/ and is only for development (not published to npm).
export default defineConfig({
  root: 'demo',
  base: './',
  server: { host: '127.0.0.1' },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  plugins: [fileProtocolFriendly()],
});
