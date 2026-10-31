import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleCloudTile, type CloudEnv } from './api/_lib/cloudTile.ts'

/**
 * Serves /api/clouds/{z}/{x}/{y} during `npm run dev` and `npm run preview` with the same
 * handler the Vercel function uses. OWM_API_KEY is read from .env.local on the server side;
 * it has no VITE_ prefix, so Vite never exposes it to the browser bundle.
 */
function cloudProxy(env: CloudEnv): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res) => {
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v)
      else if (Array.isArray(v)) headers.set(k, v.join(', '))
    }
    const url = `http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url ?? '/'}`
    handleCloudTile(new Request(url, { method: req.method, headers }), env)
      .then(async (r) => {
        res.statusCode = r.status
        r.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await r.arrayBuffer()))
      })
      .catch(() => {
        res.statusCode = 500
        res.end()
      })
  }
  return {
    name: 'quakeline-cloud-proxy',
    configureServer(server) {
      server.middlewares.use('/api/clouds', middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/clouds', middleware)
    },
  }
}

export default defineConfig(({ mode }) => {
  // The third argument '' loads every variable for server-side use only; the client still
  // receives VITE_-prefixed variables alone.
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const env: CloudEnv = {
    OWM_API_KEY: process.env.OWM_API_KEY ?? fileEnv.OWM_API_KEY,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? fileEnv.ALLOWED_ORIGINS,
  }
  return {
    plugins: [react(), cloudProxy(env)],
    // The largest chunk is the story's 3D stage (three.js), which loads only after "Follow one".
    build: { chunkSizeWarningLimit: 1000 },
  }
})
