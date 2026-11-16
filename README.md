# Orbit — 3D drone launch template

A launch page with a real-time 3D drone that flies down the page behind the text: propellers spin, it banks into turns, follows the cursor and changes finish live.
Vite + React + TypeScript + Tailwind CSS + React Three Fiber.

## Run

```bash
npm install
npm run dev
```

## Make it yours

- Texts, price, specs, finishes and FAQ: `src/config.ts`
- Flight path down the page: the `choreography` table in `src/components/Scene.tsx`
- The drone itself (built from shapes, no model file): `src/components/Drone.tsx`
- Want your own model instead? Load a `.glb` with `useGLTF` from `@react-three/drei`; shrink it first with `node scripts/optimize-model.mjs input.glb public/models/output.glb`

## Credits

The drone is modelled in code for this template. No third-party 3D assets.
