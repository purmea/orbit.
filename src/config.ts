// ─────────────────────────────────────────────────────────────
//  Orbit — edit your product here. Texts, price, specs, finishes.
//  The 3D model lives in public/models/. To use your own, export a
//  .glb from Blender (or any CC0 model) and change `modelUrl`.
// ─────────────────────────────────────────────────────────────

export const product = {
  brand: 'orbit',
  name: 'Orbit One',
  tagline: ['Sound you', 'can hold.'],
  intro: 'A portable speaker with 360° sound, a 40-hour battery and a screen that moves with your music.',
  price: 149,
  currency: '€',
  ctaLabel: 'Pre-order',
  ctaUrl: '#order', // link this to your checkout
  modelUrl: './models/boombox.glb',
}

export const story = [
  {
    eyebrow: 'Sound',
    title: ['360° sound.', 'Every seat is the best seat.'],
    body: 'Three front drivers and two side grilles push sound in every direction, so the room sounds the same wherever you stand.',
  },
  {
    eyebrow: 'Screen',
    title: ['A screen that', 'moves with the beat.'],
    body: 'The glowing panel pulses with your music and shows the track, the volume and the battery at a glance.',
  },
  {
    eyebrow: 'Battery',
    title: ['40 hours.', 'One charge.'],
    body: 'Play from Friday night to Sunday afternoon. Fifteen minutes of USB-C charging gives you four more hours.',
  },
]

export const specs = [
  { value: 40, unit: 'h', label: 'Battery life' },
  { value: 360, unit: '°', label: 'Sound field' },
  { value: 1.2, unit: 'kg', label: 'Weight', decimals: 1 },
  { value: 5.4, unit: '', label: 'Bluetooth', decimals: 1 },
]

/** Finishes tint the 3D model in real time. `tint` multiplies the model colours. */
export const finishes = [
  { id: 'graphite', name: 'Graphite', tint: '#ffffff', swatch: '#1a1a1a' },
  { id: 'signal', name: 'Signal Blue', tint: '#8fb2ff', swatch: '#2f5fd9' },
  { id: 'ember', name: 'Ember', tint: '#ffb48a', swatch: '#b8542a' },
]

export const faq = [
  { q: 'When does it ship?', a: 'Pre-orders ship in the order they were placed, starting in March.' },
  { q: 'Is it waterproof?', a: 'It is splash-proof (IPX5): rain and spills are fine, swimming is not.' },
  { q: 'Can I pair two speakers?', a: 'Yes. Pair two Orbit One speakers for stereo sound from the app.' },
  { q: 'What is in the box?', a: 'The speaker, a USB-C cable and a fabric strap.' },
]
