
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const edgeUrl = env.VITE_KUSOG_EDGE_URL || 'http://127.0.0.1:5002';
  const piHost = env.VITE_KUSOG_PI_HOST?.trim() || new URL(edgeUrl).hostname;
  const configuredRainUrl = env.VITE_KUSOG_RAIN_URL?.trim();
  const rainUrl = configuredRainUrl && !/your_|<.*>|YOUR_/i.test(configuredRainUrl)
    ? configuredRainUrl
    : `http://${piHost}:5001/api/rain`;
  const configuredCameraUrl = env.VITE_KUSOG_CAMERA_URL?.trim();
  const cameraUrl = configuredCameraUrl && !/your_|<.*>|YOUR_/i.test(configuredCameraUrl)
    ? configuredCameraUrl
    : `${edgeUrl.replace(/\/$/, '')}/camera`;
  const cameraTarget = new URL(cameraUrl);
  const rainTarget = new URL(rainUrl);

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/kusog-camera': {
          target: cameraTarget.origin,
          changeOrigin: true,
          rewrite: () => `${cameraTarget.pathname}${cameraTarget.search}`,
        },
        '/kusog-edge': {
          target: edgeUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/kusog-edge/, ''),
        },
        '/kusog-rain': {
          target: rainTarget.origin,
          changeOrigin: true,
          rewrite: () => `${rainTarget.pathname}${rainTarget.search}`,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
