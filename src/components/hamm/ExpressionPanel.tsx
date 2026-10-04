import { emotionsMismatch, faceLabel, type ExpressionReading } from "@/lib/hamm/face";
import { detectImageExpression, detectVideoExpression } from "@/lib/hamm/face-runtime";
import { emotionLabel, latestUserEmotion } from "@/lib/hamm/analyze";
import { useHamm } from "@/lib/hamm/store";
import { Button, Card } from "@/components/hamm/ui";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

function cameraErrorMessage(reason: unknown) {
  const name = reason instanceof Error ? reason.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "The browser blocked the camera. Allow camera for this site in the address bar, or upload a photo.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device. Upload a photo instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is already in use. Close the other app, or upload a photo.";
  }
  if (name === "SecurityError" || !navigator.mediaDevices?.getUserMedia) {
    return "This browser will not open the camera here. Upload a photo instead.";
  }
  const message = reason instanceof Error ? reason.message : "";
  if (/fetch|wasm|NetworkError|Failed to load/i.test(message)) {
    return "The expression model did not load. Check your connection and try again, or upload a photo.";
  }
  if (message && message.length < 180) return message;
  return "The expression model could not read this frame. The camera can stay on — try again, or upload a photo.";
}

export function ExpressionPanel() {
  const cameraConsent = useHamm((state) => state.cameraConsent);
  const setCameraConsent = useHamm((state) => state.setCameraConsent);
  const sessions = useHamm((state) => state.sessions);
  const faceSamples = useHamm((state) => state.faceSamples);
  const addFaceSample = useHamm((state) => state.addFaceSample);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const runRef = useRef(0);
  const [phase, setPhase] = useState<"idle" | "loading" | "live">("idle");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<ExpressionReading | null>(null);
  const [faceSeen, setFaceSeen] = useState(false);

  const textEmotion = latestUserEmotion(sessions);
  const mismatch = live ? emotionsMismatch(textEmotion, live.expression) : false;

  const stopCamera = () => {
    runRef.current += 1;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("idle");
  };

  useEffect(() => {
    return () => {
      runRef.current += 1;
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    setPhase("loading");
    setLive(null);
    setFaceSeen(false);
    const run = runRef.current + 1;
    runRef.current = run;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("idle");
        setError("This browser will not open the camera here. Upload a photo instead.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (runRef.current !== run) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        setPhase("idle");
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      const deadline = performance.now() + 8000;
      while (video.videoWidth === 0 && performance.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (runRef.current !== run) return;
      if (video.videoWidth === 0) {
        throw new Error("The camera opened, but no picture arrived.");
      }
      setPhase("live");
      let busy = false;
      timerRef.current = window.setInterval(() => {
        const node = videoRef.current;
        if (!node || node.readyState < 2 || node.videoWidth === 0 || busy) return;
        busy = true;
        void detectVideoExpression(node)
          .then((reading) => {
            if (runRef.current !== run) return;
            if (reading) {
              setLive(reading);
              setFaceSeen(true);
              setError(null);
            }
          })
          .catch((reason: unknown) => {
            if (runRef.current !== run) return;
            setError(cameraErrorMessage(reason));
          })
          .finally(() => {
            busy = false;
          });
      }, 450);
    } catch (reason) {
      if (runRef.current !== run) return;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setPhase("idle");
      setError(cameraErrorMessage(reason));
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    setError(null);
    setPhase("loading");
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const reading = await detectImageExpression(image);
      if (!reading) {
        setLive(null);
        setFaceSeen(false);
        setError("No face found in that photo. Use a clearer, front-facing picture.");
      } else {
        setLive(reading);
        setFaceSeen(true);
      }
    } catch (reason) {
      setError(cameraErrorMessage(reason));
    } finally {
      URL.revokeObjectURL(url);
      setPhase("idle");
    }
  };

  const keepReading = () => {
    if (!live) return;
    addFaceSample({
      id: crypto.randomUUID(),
      at: Date.now(),
      expression: live.expression,
      confidence: live.confidence,
      textEmotion,
      mismatch,
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <h2 className="font-display text-2xl text-fg sm:text-3xl">Webcam face expression</h2>
        <p className="mt-2 text-sm text-muted">
          The camera or a still photo is read on this device. A mismatch is a signal to look at, not
          proof of a hidden feeling. Detection is imperfect.
        </p>

        {!cameraConsent ? (
          <div className="mt-5 rounded-xl bg-bg px-4 py-4">
            <p className="text-sm text-fg">
              The camera stays off until you allow it. You can also upload a photo instead.
            </p>
            <Button className="mt-4 w-full sm:w-auto" onClick={() => setCameraConsent(true)}>
              Allow camera on this device
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-fg">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover ${phase === "live" ? "opacity-100" : "opacity-0"}`}
                style={{ transform: "scaleX(-1)" }}
              />
              {phase !== "live" ? (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-bg">
                  {phase === "loading" ? "Opening the camera and expression model…" : "Camera is off."}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              {phase === "live" ? (
                <Button variant="ink" onClick={stopCamera}>
                  Stop camera
                </Button>
              ) : (
                <Button onClick={() => void startCamera()} disabled={phase === "loading"}>
                  Start camera
                </Button>
              )}
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-fg">
                Upload a photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onPhoto(file);
                  }}
                />
              </label>
              <Button variant="quiet" onClick={() => setCameraConsent(false)} disabled={phase === "live"}>
                Revoke camera consent
              </Button>
            </div>
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-primary">{error}</p> : null}
      </Card>

      <div className="grid min-w-0 gap-5">
        <Card>
          <h2 className="font-display text-2xl text-fg">Words and face</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-bg px-3 py-3">
              <dt className="text-xs text-muted">Latest text emotion</dt>
              <dd className="font-display text-2xl text-fg">{emotionLabel(textEmotion)}</dd>
            </div>
            <div className="rounded-xl bg-bg px-3 py-3">
              <dt className="text-xs text-muted">Facial expression</dt>
              <dd className="font-display text-2xl text-fg">
                {live ? faceLabel(live.expression) : faceSeen ? "Unclear" : "Not read yet"}
              </dd>
              {live ? (
                <p className="text-sm text-muted">
                  Confidence {Math.round(live.confidence * 100)}%. Frames are not saved.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  {phase === "live" ? "Looking for a face in the frame." : "Start the camera or upload a photo."}
                </p>
              )}
            </div>
          </dl>
          {live && live.alternatives.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              Also possible:{" "}
              {live.alternatives
                .map((item) => `${faceLabel(item.expression)} ${Math.round(item.score * 100)}`)
                .join(" · ")}
            </p>
          ) : null}
          {live ? (
            <div className={`mt-4 rounded-xl px-3 py-3 ${mismatch ? "bg-primary text-primary-fg" : "bg-bg text-fg"}`}>
              <p className="text-sm font-medium">
                {mismatch ? "Expression and words do not match" : "No mismatch on this reading"}
              </p>
              <p className={`mt-1 text-sm ${mismatch ? "text-primary-fg" : "text-muted"}`}>
                {mismatch
                  ? `Text reads as ${emotionLabel(textEmotion).toLowerCase()} while the face reads as ${faceLabel(live.expression).toLowerCase()}. That is a signal, not proof.`
                  : "The two signals are in the same range, or one of them is too uncertain to compare."}
              </p>
            </div>
          ) : null}
          <Button className="mt-4 w-full sm:w-auto" disabled={!live} onClick={keepReading}>
            Keep this reading
          </Button>
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-fg">Face parameters</h2>
          <p className="mt-1 text-sm text-muted">
            Nine expressions can win: happy, sad, angry, anxious, fear, surprise, disgust, contempt, or
            neutral. These meters are the cues behind that choice.
          </p>
          {live ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {live.cues.map((cue) => (
                <li key={cue.key} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                    <span>{cue.label}</span>
                    <span className="tabular-nums text-fg">{Math.round(cue.value * 100)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(cue.value * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Parameters appear after a face is read.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-2xl text-fg">Kept readings</h2>
          {faceSamples.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing kept yet. Only the label, confidence, and mismatch flag are stored — not the image.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {[...faceSamples].reverse().map((sample) => (
                <li key={sample.id} className="rounded-xl bg-bg px-3 py-3 text-sm">
                  <p className="font-medium text-fg">
                    {faceLabel(sample.expression)} · text {emotionLabel(sample.textEmotion)}
                  </p>
                  <p className="text-muted">
                    {format(sample.at, "d MMM, HH:mm")} · {sample.mismatch ? "Mismatch" : "Aligned"} ·{" "}
                    {Math.round(sample.confidence * 100)}%
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
