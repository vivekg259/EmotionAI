import type { EmotionName, FaceExpression } from "@/lib/hamm/types";

export type BlendCategory = {
  categoryName: string;
  score: number;
};

export type FaceCue = {
  key: string;
  label: string;
  value: number;
};

export type ExpressionReading = {
  expression: FaceExpression;
  confidence: number;
  cues: FaceCue[];
  alternatives: { expression: FaceExpression; score: number }[];
};

function average(map: Map<string, number>, keys: string[]) {
  if (keys.length === 0) return 0;
  return keys.reduce((sum, key) => sum + (map.get(key) ?? 0), 0) / keys.length;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function expressionFromBlendshapes(categories: BlendCategory[]): ExpressionReading {
  const map = new Map(categories.map((item) => [item.categoryName, item.score]));
  const smileLeft = map.get("mouthSmileLeft") ?? 0;
  const smileRight = map.get("mouthSmileRight") ?? 0;
  const smile = (smileLeft + smileRight) / 2;
  const asymmetry = Math.abs(smileLeft - smileRight);
  const frown = average(map, ["mouthFrownLeft", "mouthFrownRight"]);
  const browDown = average(map, ["browDownLeft", "browDownRight"]);
  const browInner = map.get("browInnerUp") ?? 0;
  const browOuter = average(map, ["browOuterUpLeft", "browOuterUpRight"]);
  const eyeWide = average(map, ["eyeWideLeft", "eyeWideRight"]);
  const squint = average(map, ["eyeSquintLeft", "eyeSquintRight"]);
  const jaw = map.get("jawOpen") ?? 0;
  const press = average(map, ["mouthPressLeft", "mouthPressRight"]);
  const sneer = average(map, ["noseSneerLeft", "noseSneerRight"]);
  const upperLip = average(map, ["mouthUpperUpLeft", "mouthUpperUpRight"]);
  const stretch = average(map, ["mouthStretchLeft", "mouthStretchRight"]);
  const dimple = average(map, ["mouthDimpleLeft", "mouthDimpleRight"]);
  const pucker = map.get("mouthPucker") ?? 0;
  const cheek = average(map, ["cheekSquintLeft", "cheekSquintRight"]);

  const ranked: { expression: FaceExpression; score: number }[] = [
    { expression: "happy", score: smile * 0.75 + cheek * 0.25 },
    { expression: "angry", score: browDown * 0.55 + frown * 0.25 + press * 0.2 },
    {
      expression: "sad",
      score: frown * 0.4 + browInner * 0.35 + squint * 0.15 + Math.max(0, 0.2 - smile),
    },
    { expression: "disgust", score: sneer * 0.65 + upperLip * 0.35 },
    {
      expression: "contempt",
      score: asymmetry * 0.6 + (smile > 0.12 && frown < 0.12 ? dimple * 0.25 : 0),
    },
    { expression: "surprised", score: eyeWide * 0.4 + jaw * 0.35 + browOuter * 0.25 },
    { expression: "fear", score: eyeWide * 0.28 + browInner * 0.32 + stretch * 0.25 + jaw * 0.15 },
    { expression: "anxious", score: browInner * 0.4 + press * 0.3 + pucker * 0.15 + eyeWide * 0.15 },
  ];
  ranked.sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  const cues: FaceCue[] = [
    { key: "smile", label: "Smile", value: clamp01(smile) },
    { key: "frown", label: "Frown", value: clamp01(frown) },
    { key: "brow", label: "Brow tension", value: clamp01(browDown) },
    { key: "worry", label: "Worry", value: clamp01(browInner) },
    { key: "eyes", label: "Eye openness", value: clamp01(eyeWide) },
    { key: "jaw", label: "Jaw drop", value: clamp01(jaw) },
    { key: "lips", label: "Lip tension", value: clamp01(press) },
    { key: "nose", label: "Nose scrunch", value: clamp01(sneer) },
    { key: "squint", label: "Squint", value: clamp01(squint) },
    { key: "asymmetry", label: "Smile asymmetry", value: clamp01(asymmetry) },
  ];
  const alternatives = ranked
    .slice(1, 4)
    .filter((item) => item.score >= 0.18)
    .map((item) => ({ expression: item.expression, score: clamp01(item.score) }));

  if (!top || top.score < 0.22) {
    return {
      expression: "neutral",
      confidence: Math.max(0.45, 1 - (top?.score ?? 0)),
      cues,
      alternatives,
    };
  }

  const gap = top.score - (second?.score ?? 0);
  return {
    expression: top.expression,
    confidence: Math.max(0.35, Math.min(0.95, top.score * 0.65 + gap * 0.7)),
    cues,
    alternatives,
  };
}

export function emotionsMismatch(textEmotion: EmotionName, face: FaceExpression) {
  const negativeFace =
    face === "sad" ||
    face === "angry" ||
    face === "anxious" ||
    face === "fear" ||
    face === "disgust" ||
    face === "contempt";
  const negativeText =
    textEmotion === "sadness" ||
    textEmotion === "anxiety" ||
    textEmotion === "anger" ||
    textEmotion === "loneliness";
  if (textEmotion === "neutral" && negativeFace) return true;
  if (textEmotion === "happiness" && negativeFace) return true;
  if (negativeText && (face === "happy" || face === "contempt")) return true;
  return false;
}

export function faceLabel(expression: FaceExpression) {
  return expression.charAt(0).toUpperCase() + expression.slice(1);
}
