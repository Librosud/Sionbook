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
- Libros: campos opcionales `title_pt`, `slug_pt`, `description_pt`, `subtitle_pt`, `category_pt` en `data/books.json`. Si falta uno, el portugués usa el texto en español (el build avisa).
- Próximas obras: `subtitle_pt`, `note_pt`, `when_pt` en `data/proximas.json`.
- Textos fijos de la interfaz (botones, menús, etiquetas): objeto `T` al principio de `build.mjs`.
- Título y dirección en portugués: `title_pt` y `slug_pt` (opcionales; sin ellos se usa el original). En próximas obras: `title_pt`.
- La traducción es manual a propósito: un traductor automático puede estropear un título.

## Panel de administración
Doble clic en `abrir-panel.bat` (o `node admin.mjs`) → http://localhost:4000. Solo funciona en tu computadora (escucha únicamente en 127.0.0.1) y no se publica.
- Añadir, editar, ordenar y eliminar libros y próximas obras; subir portadas; elegir en qué idioma (ES, PT o ambos) aparece cada uno.
- Editar los textos de la editorial en español y português.
- **Guardar y actualizar** regenera la vista previa (http://localhost:3000); **Publicar** guarda en GitHub y Vercel actualiza sionbook.com.
- Antes de cada guardado se hace una copia en `admin/.backups/` (no se sube a GitHub).
- Un libro o próxima obra con `languages: ["es"]` solo sale en español; sin ese campo, sale en ambos.

## Móvil (libro abierto)
En pantallas estrechas el libro sigue siendo una doble página, pero solo se ve la hoja derecha; la izquierda (el índice) asoma por el borde.
- Abrir el índice: tocar el borde izquierdo, tocar la cinta azul o deslizar el dedo desde el borde izquierdo. Cerrarlo: tocar el borde derecho o deslizar a la izquierda.
- Pasar de sección: deslizar a la izquierda (siguiente) o a la derecha (anterior), o usar los enlaces anterior/siguiente. Al elegir una sección del índice, se vuelve a la hoja derecha y se pasa la hoja con la misma animación que en escritorio.
- Sin JavaScript, el móvil usa el diseño apilado de siempre (todo sigue funcionando).
