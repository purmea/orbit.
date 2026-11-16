# Orbit — 3D product launch template

A launch page with a real-time 3D product: it follows the cursor, rotates as you scroll and changes finish live.
Vite + React + TypeScript + Tailwind CSS + React Three Fiber.

## Run

```bash
npm install
npm run dev
```

## Make it yours

- Texts, price, specs, finishes and FAQ: `src/config.ts`
- 3D model: put your `.glb` in `public/models/` and change `modelUrl` in `src/config.ts`
- Heavy model? Shrink it: `node scripts/optimize-model.mjs input.glb public/models/output.glb`

## 3D model credit

"Boom Box" from the Khronos glTF Sample Assets, released under CC0 1.0 (public domain).
See `public/models/BOOMBOX-LICENSE.md`.
