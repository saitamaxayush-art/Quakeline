// Vercel serverless function: GET /api/clouds/{z}/{x}/{y}
// Returns one OpenWeatherMap "clouds_new" tile. The API key stays on the server (OWM_API_KEY,
// set in the Vercel project settings, never prefixed with VITE_).
import { handleCloudTile } from '../../../_lib/cloudTile.js'

export function GET(request: Request) {
  return handleCloudTile(request, process.env)
}

export const HEAD = GET
