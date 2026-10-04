import { expressionFromBlendshapes, type ExpressionReading } from "@/lib/hamm/face";

const LOCAL_WASM = "/mediapipe";
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

type RunningMode = "IMAGE" | "VIDEO";

type Landmarker = {
  detect: (image: CanvasImageSource) => FaceResult;
  detectForVideo: (video: CanvasImageSource, timestamp: number) => FaceResult;
  setOptions: (options: { runningMode: RunningMode }) => Promise<void>;
};

type FaceResult = {
  faceLandmarks: unknown[];
  faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
};

let landmarker: Landmarker | null = null;
let mode: RunningMode | null = null;
let wasmBase: string | null = null;
let lastVideoTs = 0;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function chooseWasmBase() {
  if (wasmBase) return wasmBase;
  try {
    const response = await fetch(`${LOCAL_WASM}/vision_wasm_internal.js`, { method: "HEAD" });
    wasmBase = response.ok ? LOCAL_WASM : CDN_WASM;
  } catch {
    wasmBase = CDN_WASM;
  }
  return wasmBase;
}

async function getLandmarker(runningMode: RunningMode) {
  const vision = await import("@mediapipe/tasks-vision");
  if (!landmarker) {
    const base = await chooseWasmBase();
    const fileset = await vision.FilesetResolver.forVisionTasks(base);
    try {
      landmarker = (await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "/models/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode,
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
      })) as unknown as Landmarker;
    } catch (error) {
      if (base === LOCAL_WASM) {
        wasmBase = CDN_WASM;
        const fallback = await vision.FilesetResolver.forVisionTasks(CDN_WASM);
        landmarker = (await vision.FaceLandmarker.createFromOptions(fallback, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode,
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.4,
          minFacePresenceConfidence: 0.4,
        })) as unknown as Landmarker;
      } else {
        throw error;
      }
    }
    mode = runningMode;
    return landmarker;
  }
  if (mode !== runningMode) {
    await landmarker.setOptions({ runningMode });
    mode = runningMode;
  }
  return landmarker;
}

function readResult(result: FaceResult): ExpressionReading | null {
  if (!result.faceLandmarks?.length) return null;
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  if (categories.length === 0) return null;
  return expressionFromBlendshapes(categories);
}

function nextVideoTimestamp() {
  const now = Math.round(performance.now());
  lastVideoTs = Math.max(lastVideoTs + 1, now);
  return lastVideoTs;
}

export async function detectImageExpression(image: CanvasImageSource) {
  return enqueue(async () => {
    const marker = await getLandmarker("IMAGE");
    return readResult(marker.detect(image));
  });
}

export async function detectVideoExpression(video: CanvasImageSource) {
  return enqueue(async () => {
    const marker = await getLandmarker("VIDEO");
    return readResult(marker.detectForVideo(video, nextVideoTimestamp()));
  });
}
