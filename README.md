# EmotionAI

Human Affection Manipulation by AI — a local risk instrument. It reads conversations you paste or upload, scores dependency-risk on this device, and can compare text emotion with a webcam or photo. It is not a medical diagnosis.

Data stays in the browser (`localStorage`). Nothing is sent to a server.

## Layout

```
src/
  components/hamm/     UI: score, conversations, timeline, face, privacy
  lib/hamm/            scoring, transcript import, face expression
  routes/              TanStack Start routes
public/
  models/              MediaPipe face landmarker
  mediapipe/           on-device face wasm
scripts/               Vite / env helpers
server/                server middleware used by the build
```

## Run locally

Need [Node.js 22+](https://nodejs.org).

```bash
git clone https://github.com/vivekg259/EmotionAI.git
cd EmotionAI
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

- **Score** — 0–100 dependency-risk with factor breakdown
- **Conversations** — paste, live log, or upload `.json` / `.txt` (ChatGPT export works)
- **Timeline** — last 7 days
- **Face check** — webcam or photo vs latest text emotion
- **Privacy** — export or delete the local record

The camera works on `localhost`. Photo upload and chat files work without a camera.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |

## License

Private project source. Use and modify as you like.
