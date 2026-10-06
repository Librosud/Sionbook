# Sion Book — web de la editorial

Web estática: una URL por sección, HTML indexable, móvil perfecto; el "pasar página" es solo una transición visual (sin JS todo sigue funcionando).

## Añadir o editar libros
1. Edita `data/books.json` (un bloque por libro; `slug` = parte de la URL).
2. Portadas: guarda la imagen (2:3, p. ej. 800x1200) en `assets/covers/` y pon `"cover": "/covers/archivo.jpg"`. Sin imagen se genera una portada con el color `color`.
3. Enlaces de compra: `amazonPrint`, `amazonKindle`, `googlePlay` (https://…). Los vacíos se muestran como "Próximamente".
4. Textos de la editorial y email: `site.json`.
5. `node build.mjs` → genera `dist/`. Vista previa: `node serve.mjs` (http://localhost:3000).

## Publicar en sionbook.com
Sube la carpeta del proyecto a GitHub y conéctala a Cloudflare Pages (o Netlify): build command `node build.mjs`, output directory `dist`. Después añade el dominio sionbook.com en el panel y apunta los DNS como te indique. Da de alta el sitio en Google Search Console y envía `https://sionbook.com/sitemap.xml`.

## Próximas obras
Edita `data/proximas.json` (lista de objetos: `title`, `author`, y opcionales `subtitle`, `note` (frase corta), `when` p. ej. "otoño 2026", `cover`, `color`). La sección "Próximas obras" tiene su propia hoja en el libro (`/proximas-obras/`, también en el índice), y se oculta sola si la lista está vacía. Cuando un libro se publique, pásalo a `data/books.json`.

## Idiomas (español / português)
El español vive en la raíz (`/`) y el portugués en `/pt/`, con selector **ES | PT** en la hoja izquierda y `hreflang` para Google.
- Textos de la editorial: `site.json` → bloques `es` y `pt`.
- Libros: campos opcionales `description_pt`, `subtitle_pt`, `category_pt` en `data/books.json`. Si falta uno, el portugués usa el texto en español (el build avisa).
- Próximas obras: `subtitle_pt`, `note_pt`, `when_pt` en `data/proximas.json`.
- Textos fijos de la interfaz (botones, menús, etiquetas): objeto `T` al principio de `build.mjs`.
- Los títulos de los libros no se traducen (son los de la edición).
