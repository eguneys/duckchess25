import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    server: {
        experimental: {
            websocket: true
        }
    },
    vite: {
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler'
                }
            }
        }
    }
}).addRouter({
    name: 'websocket',
    type: 'http',
    handler: './src/websocket.ts',
    target: 'server',
    base: '/_ws'
})
