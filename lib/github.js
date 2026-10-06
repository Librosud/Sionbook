// Acceso mínimo a la API de GitHub para el panel web: leer los datos y publicar cambios en UN solo commit.
// El token vive en una variable de entorno de Vercel (nunca en el código).

export class GhError extends Error {
  constructor(status, body) { super(`GitHub ${status}: ${String(body).slice(0, 300)}`); this.status = status; }
}

export function createGithub({ token, repo, branch = 'main', fetchImpl = fetch }) {
  const API = 'https://api.github.com';

  async function gh(path, { method = 'GET', body, raw = false } = {}) {
    const r = await fetchImpl(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'sionbook-admin',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new GhError(r.status, await r.text());
    return raw ? r.text() : r.json();
  }

  const readFile = (path) => gh(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, { raw: true });

  // Sube un archivo (base64) como blob suelto; se referencia después desde el commit de guardado
  async function createBlob(base64) {
    const b = await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: { content: base64, encoding: 'base64' } });
    return b.sha;
  }

  // files: [{ path, content }] (texto) o [{ path, sha }] (blob ya subido)
  async function commit(message, files) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await gh(`/repos/${repo}/git/ref/heads/${branch}`);
      const head = ref.object.sha;
      const base = await gh(`/repos/${repo}/git/commits/${head}`);
      const entries = [];
      for (const f of files) {
        const sha = f.sha || (await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: { content: f.content, encoding: 'utf-8' } })).sha;
        entries.push({ path: f.path, mode: '100644', type: 'blob', sha });
      }
      const tree = await gh(`/repos/${repo}/git/trees`, { method: 'POST', body: { base_tree: base.tree.sha, tree: entries } });
      const made = await gh(`/repos/${repo}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
      try {
        await gh(`/repos/${repo}/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: made.sha } });
        return made.sha;
      } catch (e) {
        if (e instanceof GhError && e.status === 422 && attempt === 0) continue; // alguien subió algo mientras tanto: reintento
        throw e;
      }
    }
  }

  return { readFile, createBlob, commit };
}
