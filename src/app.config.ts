import { defineConfig} from '@solidjs/start/config'


export default defineConfig({
    vite: {
        css: {
            preprocessorOptions: {
                sass: 'modern-compiler'
            }
        }
    }
})