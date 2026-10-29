import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The largest chunk is the story's 3D stage (three.js), which loads only after "Follow one".
  build: { chunkSizeWarningLimit: 1000 },
})
