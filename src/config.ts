// ─────────────────────────────────────────────────────────────
//  Orbit — edit your product here. Texts, price, specs, finishes.
//  The 3D drone is built in code (src/components/Drone.tsx),
//  and its flight path down the page lives in src/components/Scene.tsx.
// ─────────────────────────────────────────────────────────────

export const product = {
  brand: 'orbit',
  name: 'Orbit One',
  tagline: ['Fly it once.', 'Film forever.'],
  intro: 'A 249 g camera drone with a 4K stabilised camera, 34 minutes of flight and obstacle sensing in every direction.',
  price: 649,
  currency: '€',
  ctaLabel: 'Pre-order',
  ctaUrl: '#order', // link this to your checkout
}

export const story = [
  {
    eyebrow: 'Camera',
    title: ['4K at 60 fps.', 'Smooth as a dolly shot.'],
    body: 'A three-axis gimbal holds the horizon steady through wind and fast turns, so every clip looks planned.',
  },
  {
    eyebrow: 'Flight',
    title: ['34 minutes.', 'One battery.'],
    body: 'Long enough to find the shot, frame it and fly it twice. A spare battery swaps in under ten seconds.',
  },
  {
    eyebrow: 'Safety',
    title: ['Sees in every', 'direction.'],
    body: 'Six sensors map the space around it and steer around trees, walls and people on their own.',
  },
]

export const specs: { value: number; unit: string; label: string; decimals?: number }[] = [
  { value: 249, unit: 'g', label: 'Take-off weight' },
  { value: 34, unit: 'min', label: 'Flight time' },
  { value: 12, unit: 'km', label: 'Video range' },
  { value: 4, unit: 'K', label: 'Camera, 60 fps' },
]

/** Finishes recolour the drone's shell in real time. */
export const finishes = [
  { id: 'graphite', name: 'Graphite', tint: '#26282c', swatch: '#1a1a1a' },
  { id: 'arctic', name: 'Arctic', tint: '#e8ebee', swatch: '#e8ebee' },
  { id: 'signal', name: 'Signal Blue', tint: '#2f5fd9', swatch: '#2f5fd9' },
]

export const faq = [
  { q: 'Do I need a licence to fly it?', a: 'Under 250 g it falls in the lightest category in most countries. Check your local rules before flying in public spaces.' },
  { q: 'When does it ship?', a: 'Pre-orders ship in the order they were placed, starting in March.' },
  { q: 'Can I fly it with my phone?', a: 'Yes. The app streams live video to your phone, and the controller in the box gives you longer range.' },
  { q: 'What is in the box?', a: 'The drone, a controller, one battery, spare propellers and a USB-C cable.' },
]
