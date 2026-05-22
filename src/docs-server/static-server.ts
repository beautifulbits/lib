import { createServer, type Server } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/* ========================================================================== */
/*                              STATIC FILE SERVER                            */
/* ========================================================================== */

/**
 * A tiny static-file HTTP server with directory-index resolution and a
 * 404.html fallback. Used to serve the pre-built Starlight site out of
 * `docs/dist/` from any host project, with no Astro runtime needed.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export function createStaticServer(rootDir: string): Server {
  return createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(
        new URL(req.url ?? '/', 'http://localhost').pathname,
      );
      let filePath = path.join(rootDir, urlPath);

      // Path-traversal guard
      const resolvedRoot = path.resolve(rootDir);
      const resolvedFile = path.resolve(filePath);
      if (
        resolvedFile !== resolvedRoot &&
        !resolvedFile.startsWith(resolvedRoot + path.sep)
      ) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // Directory → index.html
      try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch {
        // pass through to readFile, which will surface ENOENT
      }

      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] ?? 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      // Try the site's 404.html, fall back to plain 404
      try {
        const data = await fs.readFile(path.join(rootDir, '404.html'));
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }
  });
}

export async function listenOnAvailablePort(
  server: Server,
  preferredPort: number,
): Promise<number> {
  // Try the preferred port; if EADDRINUSE, try sequential ones up to +20.
  for (let port = preferredPort; port < preferredPort + 20; port++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
          server.off('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port);
      });
      return port;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE') throw err;
      // try next port
    }
  }
  throw new Error(
    `No available port in range ${preferredPort}-${preferredPort + 19}.`,
  );
}
