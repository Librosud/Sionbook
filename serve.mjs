// Servidor local para previsualizar dist/ →  node serve.mjs  (http://localhost:3000)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(dist, p);
  if (!file.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(dist, '404.html')).pipe(res);
}).on('error', (e) => { if (e.code === 'EADDRINUSE') console.log('La vista previa ya estaba abierta en http://localhost:3000'); else throw e; })
  .listen(3000, () => console.log('Vista previa en http://localhost:3000'));
