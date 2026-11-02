# Interacción

Plataforma web multiusuario para crear perfiles públicos individuales.

## Cómo funciona

- Cualquier visitante puede crear una cuenta con correo, contraseña y un nombre público.
- El nombre visible no requiere apellidos y puede repetirse.
- Cada cuenta recibe un ID interno UUID vinculado a Supabase Auth.
- Cada perfil tiene un identificador de dirección (`handle`) único. Si dos personas usan el mismo nombre, el sistema añade un sufijo al enlace sin cambiar el nombre público.
- Las direcciones siguen el formato `/interaccion/usuario`.
- El propietario puede editar su nombre público, dirección y descripción.
- Los perfiles públicos se consultan desde la tabla `public.profiles`; las políticas RLS limitan las modificaciones al propietario.

## Servicios

- **Frontend:** GitHub Pages (rama `main`, carpeta raíz).
- **Autenticación y base de datos:** Supabase.
- **Clave del navegador:** publishable key en `supabase-config.js`. Nunca colocar una service-role/secret key en el frontend.

## Publicación

En GitHub abre **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**, rama **main** y carpeta **/(root)**. El archivo `404.html` permite resolver los enlaces de perfil en este alojamiento estático.

La primera publicación puede tardar unos minutos. Los commits posteriores a `main` actualizan la web.

## Archivos principales

- `index.html`: interfaz de Interacción, acceso y formularios.
- `interaccion.js`: registro, inicio de sesión, lectura y edición de perfiles.
- `404.html`: recuperación de enlaces directos a perfiles.
- `supabase-config.js`: URL y clave publicable de Supabase.
- `mbm-community.js`: funciones heredadas de la página anterior; el contenido global antiguo ya no se aplica a los perfiles multiusuario.
- `sw.js`: caché y actualización de la aplicación.

## Datos de perfil

La tabla `public.profiles` usa `id` como UUID relacionado con `auth.users.id`. El nombre público se guarda en `name`; el enlace único se guarda en `handle`. Un trigger crea automáticamente el perfil al registrarse una cuenta.
