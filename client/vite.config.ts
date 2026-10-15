import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [react(), VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        manifest: {
            name: 'ArtVista Art School Management',
            short_name: 'ArtVista',
            description: 'Manage students, Sunday attendance and art school fees.',
            theme_color: '#5b5cf0',
            background_color: '#f8faff',
            display: 'standalone',
            start_url: '/',
            icons: [],
        },
    })],
    server: {
        proxy: {
            '/api': 'http://localhost:4000',
        },
    },
});
