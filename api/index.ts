import type { IncomingMessage, ServerResponse } from 'node:http'
import { runtimeApp } from '../server/runtime'
let app: ReturnType<typeof runtimeApp> | undefined
export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Vercel rewrite carries the public API path; never use request input as a filesystem path.
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/api' || url.pathname === '/api/index') {
    const route = url.searchParams.get('__route') || ''
    url.searchParams.delete('__route')
    req.url = '/api/' + route + (url.search ? url.search : '')
  }
  app ??= runtimeApp()
  return app(req, res)
}
