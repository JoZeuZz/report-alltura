/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import eslintPlugin from 'vite-plugin-eslint';
import checker from 'vite-plugin-checker';
import path from 'path';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';
  const env = loadEnv(mode, process.cwd(), '');

  const readEnvTarget = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  };

  const devApiProxyTarget =
    readEnvTarget(env.VITE_DEV_API_PROXY_TARGET) ?? readEnvTarget(env.BACKEND_URL);

  if (isDev && !devApiProxyTarget) {
    throw new Error(
      '[vite] Debes definir VITE_DEV_API_PROXY_TARGET o BACKEND_URL para habilitar el proxy /api en desarrollo.'
    );
  }

  return {
    plugins: [
      react(),
      // Only run eslint and type checker in development
      ...(isDev
        ? [
            eslintPlugin({
              overrideConfigFile: path.resolve(__dirname, 'eslint.config.js'),
              failOnError: false,
            }),
            checker({ typescript: true }),
          ]
        : []),
      svgr(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: devApiProxyTarget as string,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      css: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
