# Perfil personal MBM

Página personal estática, adaptable a móviles y publicada con GitHub Pages. No usa servidor, base de datos ni servicios de pago.

## Personalizar el perfil

1. Abre `profile.js` en GitHub.
2. Pulsa el lápiz (**Edit this file**).
3. Cambia nombre, descripción, intereses y enlaces de redes.
4. Guarda con **Commit changes**. GitHub Pages publicará los cambios automáticamente cuando esté configurado.

## Añadir tu fotografía

1. En el repositorio, crea o abre la carpeta `assets`.
2. Sube tu foto principal con el nombre exacto `profile.jpg`.
3. Para la galería, sube imágenes a `assets/` y añade sus rutas en el arreglo `photos` de `profile.js`, por ejemplo: `"assets/foto-1.jpg"`.

## Publicar con GitHub Pages

En el repositorio ve a **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**, elige la rama **main** y la carpeta **/(root)**, y pulsa **Save**. La dirección será:

`https://athenacoree.github.io/Marlon-Baez-Mendez.MBM/`

La primera publicación puede tardar unos minutos. Cada commit posterior a `main` actualiza la página.

## Archivos

- `index.html`: diseño, estilos, animaciones e interacción.
- `profile.js`: contenido editable del perfil.
- `assets/`: fotografías que subas.
