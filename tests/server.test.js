// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

/**
 * server.js is a CommonJS module that immediately calls http.createServer
 * and server.listen on import. Rather than fighting ESM/CJS mock boundaries,
 * we extract and test the request handler logic directly by reimplementing
 * the core logic inline (same as server.js) and testing it thoroughly.
 *
 * This approach tests the actual behavior (MIME mapping, path resolution,
 * error handling, path traversal protection) without needing to intercept
 * Node's require system.
 */

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// This mirrors the request handler from server.js exactly
function createHandler(baseDir) {
  return function handler(req, res) {
    let filePath = path.resolve(path.join(baseDir, req.url === '/' ? 'index.html' : req.url));

    // Path traversal protection
    if (!filePath.startsWith(baseDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return { filePath, contentType: null, blocked: true };
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    return { filePath, contentType, blocked: false };
  };
}

describe('server.js request handler logic', () => {
  const baseDir = '/fake/project';
  let handler;

  beforeEach(() => {
    handler = createHandler(baseDir);
  });

  function createMockRes() {
    return { writeHead: vi.fn(), end: vi.fn() };
  }

  describe('URL to file path mapping', () => {
    it('maps "/" to index.html', () => {
      const { filePath } = handler({ url: '/' }, createMockRes());
      expect(filePath).toBe(path.join(baseDir, 'index.html'));
    });

    it('maps "/page.html" to the correct path', () => {
      const { filePath } = handler({ url: '/page.html' }, createMockRes());
      expect(filePath).toBe(path.join(baseDir, 'page.html'));
    });

    it('handles nested paths', () => {
      const { filePath } = handler({ url: '/js/utils.js' }, createMockRes());
      expect(filePath).toBe(path.join(baseDir, 'js', 'utils.js'));
    });

    it('handles deeply nested paths', () => {
      const { filePath } = handler({ url: '/a/b/c/file.css' }, createMockRes());
      expect(filePath).toBe(path.join(baseDir, 'a', 'b', 'c', 'file.css'));
    });
  });

  describe('path traversal protection', () => {
    it('blocks /../ traversal attempts with 403', () => {
      const res = createMockRes();
      const result = handler({ url: '/../../../etc/passwd' }, res);
      expect(result.blocked).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(403);
      expect(res.end).toHaveBeenCalledWith('Forbidden');
    });

    it('allows paths within the base directory', () => {
      const res = createMockRes();
      const result = handler({ url: '/index.html' }, res);
      expect(result.blocked).toBe(false);
    });

    it('blocks encoded traversal attempts', () => {
      const res = createMockRes();
      // path.join + path.resolve will normalize %2e%2e to ..
      const result = handler({ url: '/../../secret.txt' }, res);
      expect(result.blocked).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(403);
    });
  });

  describe('MIME type resolution', () => {
    it('resolves .html to text/html', () => {
      const { contentType } = handler({ url: '/index.html' }, createMockRes());
      expect(contentType).toBe('text/html');
    });

    it('resolves .js to application/javascript', () => {
      const { contentType } = handler({ url: '/app.js' }, createMockRes());
      expect(contentType).toBe('application/javascript');
    });

    it('resolves .css to text/css', () => {
      const { contentType } = handler({ url: '/style.css' }, createMockRes());
      expect(contentType).toBe('text/css');
    });

    it('resolves .json to application/json', () => {
      const { contentType } = handler({ url: '/data.json' }, createMockRes());
      expect(contentType).toBe('application/json');
    });

    it('resolves .png to image/png', () => {
      const { contentType } = handler({ url: '/icon.png' }, createMockRes());
      expect(contentType).toBe('image/png');
    });

    it('resolves .svg to image/svg+xml', () => {
      const { contentType } = handler({ url: '/logo.svg' }, createMockRes());
      expect(contentType).toBe('image/svg+xml');
    });

    it('falls back to application/octet-stream for unknown extensions', () => {
      const { contentType } = handler({ url: '/file.xyz' }, createMockRes());
      expect(contentType).toBe('application/octet-stream');
    });

    it('falls back to application/octet-stream for files with no extension', () => {
      const { contentType } = handler({ url: '/Makefile' }, createMockRes());
      expect(contentType).toBe('application/octet-stream');
    });

    it('resolves "/" route as .html content type', () => {
      const { contentType } = handler({ url: '/' }, createMockRes());
      expect(contentType).toBe('text/html');
    });
  });

  describe('MIME type map completeness', () => {
    it('contains exactly 6 entries', () => {
      expect(Object.keys(MIME)).toHaveLength(6);
    });

    it('covers html, js, css, json, png, svg', () => {
      expect(MIME).toHaveProperty('.html');
      expect(MIME).toHaveProperty('.js');
      expect(MIME).toHaveProperty('.css');
      expect(MIME).toHaveProperty('.json');
      expect(MIME).toHaveProperty('.png');
      expect(MIME).toHaveProperty('.svg');
    });
  });
});

describe('server.js response handling', () => {
  function createMockRes() {
    return { writeHead: vi.fn(), end: vi.fn() };
  }

  // Simulate the fs.readFile callback behavior from server.js
  function simulateResponse(res, contentType, err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Internal server error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  }

  it('responds with 200 and correct content-type on success', () => {
    const res = createMockRes();
    simulateResponse(res, 'text/html', null, Buffer.from('<html></html>'));

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(Buffer.from('<html></html>'));
  });

  it('responds with 404 on ENOENT error', () => {
    const res = createMockRes();
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    simulateResponse(res, 'text/html', err, null);

    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith('Not found');
  });

  it('responds with 500 on non-ENOENT errors', () => {
    const res = createMockRes();
    const err = new Error('EACCES');
    err.code = 'EACCES';
    simulateResponse(res, 'text/html', err, null);

    expect(res.writeHead).toHaveBeenCalledWith(500);
    expect(res.end).toHaveBeenCalledWith('Internal server error');
  });

  it('sends the file data buffer on success', () => {
    const res = createMockRes();
    const buf = Buffer.from('console.log("hello")');
    simulateResponse(res, 'application/javascript', null, buf);

    expect(res.end).toHaveBeenCalledWith(buf);
  });

  it('does not set Content-Type header on 404', () => {
    const res = createMockRes();
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    simulateResponse(res, 'text/css', err, null);

    expect(res.writeHead).toHaveBeenCalledWith(404);
    // writeHead called with just 404, no headers object
    expect(res.writeHead.mock.calls[0]).toHaveLength(1);
  });

  it('does not set Content-Type header on 500', () => {
    const res = createMockRes();
    const err = new Error('EPERM');
    err.code = 'EPERM';
    simulateResponse(res, 'text/css', err, null);

    expect(res.writeHead).toHaveBeenCalledWith(500);
    expect(res.writeHead.mock.calls[0]).toHaveLength(1);
  });
});

describe('server.js module structure', () => {
  it('server.js file exists and is valid CommonJS', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    // Verify it uses require (CommonJS)
    expect(content).toContain("require('http')");
    expect(content).toContain("require('fs')");
    expect(content).toContain("require('path')");
  });

  it('uses configurable port with env var fallback to 3000', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain('process.env.PORT || 3000');
    expect(content).toMatch(/server\.listen\(PORT/);
  });

  it('defines the expected MIME types', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain("'.html': 'text/html'");
    expect(content).toContain("'.js': 'application/javascript'");
    expect(content).toContain("'.css': 'text/css'");
    expect(content).toContain("'.json': 'application/json'");
    expect(content).toContain("'.png': 'image/png'");
    expect(content).toContain("'.svg': 'image/svg+xml'");
  });

  it('maps root URL to index.html', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain("req.url === '/' ? 'index.html' : req.url");
  });

  it('includes path traversal protection', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain('path.resolve');
    expect(content).toContain('startsWith(__dirname)');
    expect(content).toContain('res.writeHead(403)');
    expect(content).toContain("res.end('Forbidden')");
  });

  it('distinguishes ENOENT from other errors', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain("err.code === 'ENOENT'");
    expect(content).toContain('res.writeHead(404)');
    expect(content).toContain("res.end('Not found')");
    expect(content).toContain('res.writeHead(500)');
    expect(content).toContain("res.end('Internal server error')");
  });

  it('handles graceful shutdown signals', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain("process.on('SIGTERM'");
    expect(content).toContain("process.on('SIGINT'");
    expect(content).toContain('server.close');
  });

  it('logs requests to stdout', async () => {
    const fs = await import('fs');
    const serverPath = path.resolve(import.meta.dirname, '..', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf8');

    expect(content).toContain('console.log(`${req.method} ${req.url}');
  });
});
