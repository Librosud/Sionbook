// Prepara el acceso a sionbook.com/admin.
// Uso:  node admin-setup.mjs   (o doble clic en crear-acceso-admin.bat)
//
// Te pide tu correo y una contraseña (no se ve al escribirla), y te imprime 3 valores para pegar en Vercel.
// La contraseña NO se guarda en ningún archivo ni se envía a ningún sitio: solo se muestra su versión cifrada.

import readline from 'node:readline';
import crypto from 'node:crypto';
import { hashPassword } from './lib/auth.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
let muted = false;
rl._writeToOutput = (s) => { if (!muted) process.stdout.write(s); else if (s.includes('\n') || s.includes('\r')) process.stdout.write('\n'); };
// Cola de líneas: funciona igual escribiendo a mano que con entrada redirigida
const queue = []; let waiter = null;
rl.on('line', (l) => { if (waiter) { const w = waiter; waiter = null; w(l); } else queue.push(l); });
rl.on('close', () => { if (waiter) { const w = waiter; waiter = null; w(''); } });
const ask = (q, hidden = false) => { process.stdout.write(q); muted = hidden; return new Promise((res) => { const done = (l) => { muted = false; res(l); }; if (queue.length) done(queue.shift()); else waiter = done; }); };

console.log('\n=== Acceso al panel de administración de Sion Book ===\n');
const email = (await ask('Tu correo (el que usarás para entrar): ')).trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.log('\nEse correo no parece válido.'); process.exit(1); }

const p1 = await ask('Elige una contraseña (mínimo 12 caracteres, no se ve al escribir): ', true);
if (p1.length < 12) { console.log('\nLa contraseña debe tener al menos 12 caracteres. Una frase larga es mejor que una palabra con símbolos.'); process.exit(1); }
const p2 = await ask('Repite la contraseña: ', true);
if (p1 !== p2) { console.log('\nNo coinciden. Vuelve a empezar.'); process.exit(1); }
rl.close();

console.log('\nCifrando…');
const hash = await hashPassword(p1);
const secret = crypto.randomBytes(48).toString('base64url');

console.log(`
Listo. En Vercel → tu proyecto "sionbook" → Settings → Environment Variables, crea estas 3 variables
(marca los tres entornos: Production, Preview y Development) pegando el valor tal cual:

  ADMIN_EMAIL          ${email}
  ADMIN_PASSWORD_HASH  ${hash}
  SESSION_SECRET       ${secret}

Y una cuarta, que sale de GitHub (ver el paso a paso):

  GITHUB_TOKEN         (el token que crees en GitHub)

Después, en Vercel → Deployments → ⋯ → Redeploy, para que las variables entren en vigor.

Importante: no compartas estos valores con nadie ni los pegues en el chat. Tu contraseña real no aparece aquí y no se guardó en ningún sitio.
`);
