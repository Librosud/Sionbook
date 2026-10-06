// Función de Vercel: panel de administración (sionbook.com/admin). La lógica está en lib/admin-api.js.
import { createHandler } from '../lib/admin-api.js';

export default createHandler(process.env);
