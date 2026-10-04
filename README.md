# AI Racer

A population of neural-network cars learns to stay on track and race faster using neuroevolution (a genetic algorithm), in plain HTML, JS and Canvas.

## Run

```bash
npm run dev          # launches Vite dev server on http://localhost:5173 (with Hot Module Reloading)
npm run build        # bundles production release to dist/
npm run preview      # locally previews production build
npm run test:headless # trains 60 generations in Node headlessly and prints stats
```

## How it works

- **Inputs (8):** 7 raycast wall distances (-90°…+90°) and speed
- **Brain:** MLP 8 → 12 → 8 → 2 (tanh) → steer, throttle/brake
- **Fitness:** distance progressed + lap bonus + faster-lap bonus − crash penalty
- **Evolution:** 80 cars, 2 elites, tournament selection, uniform crossover, Gaussian mutation
- A car is eliminated on a wall hit, no progress for 3 s, or driving the wrong way. A generation ends when all cars are out or 40 s pass.

All tunables live in [`js/config.js`](js/config.js).

## Controls

| Key | Action |
|---|---|
| Space | Pause / resume |
| O | Toggle 3D Orbit Camera / 2D Top-Down View |
| Mouse Drag (3D) | Orbit & rotate camera in 360° |
| Scroll (3D) | Zoom in / out |
| Right-click Drag (3D) | Pan camera position |
| T | Turbo (as fast as the CPU allows) |
| F | Follow the leader car |
| V | Toggle sensors |
| G | Toggle population ghosts |
| M | Drive yourself (arrow keys) |
| R | Reset training |
