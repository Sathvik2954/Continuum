// Resolves a server-relative path (e.g. "/uploads/audio/xyz.webm")
// into a full URL pointing at the Express server.
//
// In dev, Vite proxies /api/* but NOT /uploads/*, so audio files need
// the full server origin. In production, set VITE_API_ORIGIN to your
// deployed backend URL.

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

export function resolveFileUrl(path?: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path}`;
}
