import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', ''); // loads .env files
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Add the server proxy configuration here
      server: {
        proxy: {
          // Proxy API requests from /api to your backend server
          '/api': {
            target: 'http://0.0.0.0:8000', // Your FastAPI backend URL
            changeOrigin: true, // Recommended for virtual hosted sites
            // rewrite: (path) => path.replace(/^\/api/, ''), // Use if your FastAPI routes don't start with /api
                                                              // In our case, FastAPI routes *do* start with /api (settings.API_V1_STR)
                                                              // So, if API_V1_STR in FastAPI is '/api', you might not need rewrite, 
                                                              // or if API_V1_STR is empty for routes, then rewrite is needed.
                                                              // Given the current FastAPI setup (prefix=settings.API_V1_STR which is '/api'),
                                                              // the target should handle it. So, no rewrite needed initially.
          }
        }
      }
    };
});