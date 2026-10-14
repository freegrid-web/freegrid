import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json',
  '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif',
};

/** Serves files under `root`; `pages` maps URL paths to in-memory HTML. Resolves to { url, close }. */
export function startServer(root, pages) {
  const server = createServer(async(req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

    if (pages[path]) {
      res.writeHead(200, { 'content-type': 'text/html' }).end(pages[path]);
      return;
    }
    const file = normalize(join(root, path));

    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);

      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise(done => server.close(done)),
    }));
  });
}
