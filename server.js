const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let filePath = path.resolve(path.join(__dirname, req.url === '/' ? 'index.html' : req.url));

  // Path traversal protection
  if (!filePath.startsWith(__dirname)) {
    console.log(`${req.method} ${req.url} 403`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log(`${req.method} ${req.url} 404`);
        res.writeHead(404);
        res.end('Not found');
      } else {
        console.error(`Error serving ${filePath}: ${err.message}`);
        console.log(`${req.method} ${req.url} 500`);
        res.writeHead(500);
        res.end('Internal server error');
      }
      return;
    }
    console.log(`${req.method} ${req.url} 200`);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
