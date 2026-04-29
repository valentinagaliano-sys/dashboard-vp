# Dashboard VP Proyectos 2026

App web (Next.js + Supabase Auth) que permite a cada socio entrar con email y contraseña y ver el estado de sus proyectos. Los datos vienen en vivo del Google Sheet `Plan_Trabajo_VP_Proyectos_2026`.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind**
- **Supabase Auth** (email + contraseña)
- **Google Sheets API** vía service account (lectura)
- **Vercel** (hosting + deploy continuo desde GitHub)

## Cómo funciona

1. El socio entra a la URL pública y se autentica con email/contraseña en Supabase.
2. El backend resuelve el socio a partir del **dominio del email** (ej: `@bci.cl` → BCI). El mapeo está en `src/lib/partner-mapping.ts`.
3. La API `GET /api/sheet` lee el Sheet (con caché de 2 min) y filtra solo las filas del socio.
4. El dashboard muestra la información agrupada por solución y un mini-Gantt semanal.
5. Los emails con dominio `@feconsulting.cl` ven todos los socios.

---

## 🚀 Guía de despliegue paso a paso

Estimado: 60–90 min la primera vez.

### Paso 1 — Crear cuenta de GitHub

1. Anda a [github.com/signup](https://github.com/signup) y crea una cuenta con tu email.
2. Verifica el email.
3. Crea un repositorio nuevo: `dashboard-vp` (privado).

### Paso 2 — Subir este código a GitHub

Desde tu computador (asumiendo que ya tienes Git instalado):

```bash
cd dashboard-vp
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/dashboard-vp.git
git push -u origin main
```

Si no tienes Git, descárgalo desde [git-scm.com](https://git-scm.com/) o usa GitHub Desktop.

### Paso 3 — Crear proyecto en Supabase

1. Anda a [supabase.com](https://supabase.com/) y crea cuenta (gratuita).
2. Crea un proyecto nuevo. Elige una región cercana (ej: `South America (São Paulo)`).
3. Guarda la contraseña de la base de datos (no la usaremos pero puede pedírtela).
4. Una vez creado el proyecto, anda a **Project Settings → API Keys**. Copia:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `Publishable key` (empieza con `sb_publishable_...`) → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Nota: en proyectos antiguos esta key se llamaba "anon public". Es lo mismo, ahora se llama "Publishable".
     - **NO uses** la "Secret key" (`sb_secret_...`) — esa nunca va en el código.
5. Anda a **Authentication → Providers → Email**: deja habilitado, y desactiva "Confirm email" para acelerar el onboarding (puedes activarlo después).
6. Anda a **Authentication → Users → Add user → Create new user**: agrega un usuario por cada socio que tendrá acceso. Define email y contraseña inicial.

### Paso 4 — Crear service account en Google Cloud

Esto le da a la app permiso para leer el Sheet desde el servidor.

1. Anda a [console.cloud.google.com](https://console.cloud.google.com/) e inicia sesión con la cuenta Google que tiene acceso al Sheet (`@feconsulting.cl`).
2. Crea un proyecto nuevo: **Create Project** → nombre `dashboard-vp`.
3. Habilita la **Google Sheets API**: en el buscador escribe "Sheets API" → Enable.
4. Anda a **IAM & Admin → Service Accounts → Create Service Account**:
   - Nombre: `dashboard-vp-reader`
   - Rol: déjalo en blanco (no necesita permisos de GCP).
   - Click **Done**.
5. Click en el service account recién creado → pestaña **Keys → Add Key → Create new key → JSON**. Se descarga un archivo `.json`. **Guárdalo seguro.**
6. Abre el JSON y anota:
   - `client_email` → será `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → será `GOOGLE_PRIVATE_KEY` (es un string largo con `\n` adentro)

### Paso 5 — Compartir el Sheet con el service account

1. Abre el Sheet `Plan_Trabajo_VP_Proyectos_2026` en Drive.
2. Click **Share** (Compartir).
3. Pega el `client_email` del service account (ej: `dashboard-vp-reader@xxx.iam.gserviceaccount.com`).
4. Permiso: **Viewer** (solo lectura).
5. Desmarca "Notify people". Click **Share**.

### Paso 6 — Desplegar en Vercel

1. Anda a [vercel.com/signup](https://vercel.com/signup) y crea cuenta usando tu cuenta de GitHub.
2. Click **Add New → Project**.
3. Importa el repositorio `dashboard-vp`.
4. En la sección **Environment Variables**, agrega estas 5 variables (toma los valores de los pasos anteriores):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key de Supabase (`sb_publishable_...`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | client_email del JSON |
| `GOOGLE_PRIVATE_KEY` | **private_key del JSON, completa, incluyendo `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`**. Vercel acepta multilinea. |
| `SHEET_ID` | `12fO8p5KMzOlzzMxZHQXt3_AFa0Bn0w28pvySSCFAN2c` |
| `SHEET_RANGE` | Ejemplo: `Gantt!A1:AT200` (ajusta si tu pestaña tiene otro nombre) |

5. Click **Deploy**.
6. Cuando termine, te dará una URL tipo `https://dashboard-vp.vercel.app`.

### Paso 7 — Probar

1. Abre la URL de Vercel.
2. Te debe redirigir a `/login`.
3. Ingresa con un email/password de los que creaste en Supabase (paso 3.6).
4. Si el dominio del email está mapeado en `partner-mapping.ts` → ves el dashboard de ese socio.
5. Si no, te muestra un mensaje pidiendo contactar al ejecutivo FE.

### Paso 8 — Configurar el mapeo de socios

Edita `src/lib/partner-mapping.ts` y ajusta:

```ts
const DOMAIN_TO_PARTNER: Record<string, string> = {
  "bci.cl": "BCI",
  "walmart.com": "Walmart",
  // ...
  "nicolasinc.com": "Nicolas Inc",  // Ejemplo
};
```

Luego haz commit y push: Vercel redeploya automáticamente.

---

## Desarrollo local

```bash
cd dashboard-vp
cp .env.local.example .env.local
# completa .env.local con los mismos valores que en Vercel
npm install
npm run dev
# abre http://localhost:3000
```

## Estructura

```
dashboard-vp/
├── middleware.ts                       # protección de rutas
├── src/
│   ├── app/
│   │   ├── api/sheet/route.ts          # API protegida que lee el Sheet
│   │   ├── auth/signout/route.ts       # logout
│   │   ├── dashboard/page.tsx          # dashboard del socio
│   │   ├── login/page.tsx              # login Supabase
│   │   ├── layout.tsx
│   │   └── page.tsx                    # redirect según sesión
│   ├── components/
│   │   └── SignOutButton.tsx
│   └── lib/
│       ├── partner-mapping.ts          # email/dominio → socio
│       ├── sheets.ts                   # cliente Google Sheets API + caché
│       └── supabase/
│           ├── client.ts               # cliente browser
│           ├── middleware.ts           # refresh de sesión
│           └── server.ts               # cliente server
└── ...
```

## Próximos pasos sugeridos

- Habilitar "Confirm email" en Supabase y enviar invitaciones reales en lugar de crear usuarios manualmente.
- Agregar página `/admin` con auth de FE para gestionar el mapeo de socios sin desplegar código.
- Agregar histórico de estado (snapshots semanales) si quieres ver evolución.
- Branding: logo, colores corporativos, dominio propio (ej: `dashboard.feconsulting.cl`).
- Habilitar 2FA en Supabase para los socios.
