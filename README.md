# Dashboard Prototipo ConversaAI (Next.js)

Versión del dashboard portada desde el prototipo Vite. Proyecto independiente en esta carpeta; el original no se modifica.

## Requisitos

- Node.js 20+ recomendado

## Instalación y desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estilos

El CSS global entra por [`src/app/layout.tsx`](src/app/layout.tsx) con:

`import "@src/styles/tailwind.css"`

Tailwind v4 vía `@tailwindcss/postcss`; tema y fuentes se encadenan dentro de [`src/styles/tailwind.css`](src/styles/tailwind.css).

## Build

```bash
npm run build
npm start
```

Nota: `legacy-peer-deps` está activado en [`.npmrc`](.npmrc) por compatibilidad de algunas librerías con React 19.
