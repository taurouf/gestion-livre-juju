// components/IsbnScanner.js
"use client";

import { useEffect, useRef, useState } from "react";

export default function IsbnScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [track, setTrack] = useState(null);

  useEffect(() => {
    let stream;
    let cancelled = false;

    async function start() {
      setError("");
      try {
        // Caméra arrière si possible
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) return;
        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const t = stream.getVideoTracks?.()[0];
        setTrack(t);

        // torch si dispo
        try {
          const caps = t?.getCapabilities?.() || {};
          if (!caps.torch) setTorchOn(false);
        } catch {}

        setRunning(true);
      } catch (e) {
        setError(e?.message || "Impossible d'accéder à la caméra.");
      }
    }
    start();

    return () => {
      cancelled = true;
      setRunning(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (stream) {
        for (const tr of stream.getTracks()) tr.stop();
      }
    };
  }, []);

  // boucle de détection
  useEffect(() => {
    if (!running) return;
    if (!("BarcodeDetector" in window)) {
      setError(
        "Votre navigateur ne supporte pas la détection native. Utilisez Chrome/Edge/Android récents."
      );
      return;
    }

    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
    });

    const loop = async () => {
      if (!running || !videoRef.current) return;
      try {
        // Délimiter la zone de scan au cadre central pour plus de précision
        const v = videoRef.current;
        const vw = v.videoWidth;
        const vh = v.videoHeight;

        // cadre ~ 70% largeur, ratio 2:1
        const boxW = Math.round(vw * 0.72);
        const boxH = Math.round(boxW / 2);
        const sx = Math.round((vw - boxW) / 2);
        const sy = Math.round((vh - boxH) / 2);

        // on dessine la frame dans un canvas offscreen pour "croper"
        const canvas = new OffscreenCanvas(boxW, boxH);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(v, sx, sy, boxW, boxH, 0, 0, boxW, boxH);
        const bitmap = canvas.transferToImageBitmap();

        const detections = await detector.detect(bitmap);

        if (detections && detections.length) {
          // cherche d’abord EAN-13
          const best =
            detections.find((d) => d.format === "ean_13") ||
            detections.find((d) => d.rawValue?.length >= 8) ||
            detections[0];

          if (best?.rawValue) {
            const isbn = best.rawValue.replace(/[^\dXx]/g, "");
            stopAndSend(isbn);
            return;
          }
        }
      } catch (e) {
        // pas de spam d’erreur
      }
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [running]);

  function stopAndSend(code) {
    setRunning(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    try {
      const stream = videoRef.current?.srcObject;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    onDetected?.(code);
    onClose?.();
  }

  async function toggleTorch() {
    if (!track?.applyConstraints) return;
    try {
      const caps = track.getCapabilities?.() || {};
      if (!caps.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 text-white">
      {/* header */}
      <div className="absolute left-0 right-0 top-0 p-3 flex items-center justify-between">
        <div className="text-sm opacity-80">Scanner un code EAN-13</div>
        <button
          onClick={onClose}
          className="rounded-xl px-3 py-2 bg-white/10 hover:bg-white/20"
        >
          Fermer
        </button>
      </div>

      {/* vidéo + overlay */}
      <div className="h-full w-full grid place-items-center px-4">
        <div className="relative w-full max-w-[520px]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-2xl ring-1 ring-white/20"
          />

          {/* masque sombre + cadre centré */}
          <div className="pointer-events-none absolute inset-0">
            {/* masque */}
            <div className="absolute inset-0">
              <div className="mask-layer w-full h-full" />
            </div>

            {/* cadre */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="scan-box">
                {/* ligne rouge animée */}
                <div className="scan-line" />
              </div>
            </div>
          </div>

          {/* message */}
          <div className="absolute -bottom-12 left-0 right-0 text-center text-sm opacity-90">
            Alignez le code-barres dans le cadre
          </div>
        </div>
      </div>

      {/* actions bas */}
      <div className="absolute left-0 right-0 bottom-0 p-4 flex items-center justify-center gap-3">
        <button
          onClick={toggleTorch}
          className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20"
        >
          {torchOn ? "Éteindre lampe" : "Allumer lampe"}
        </button>
        {error && <div className="text-red-300 text-sm">{error}</div>}
      </div>

      {/* styles inline */}
      <style jsx>{`
        .mask-layer {
          --box-w: min(72vw, 480px);
          --box-h: calc(var(--box-w) / 2);
          --line: 3px;

          /* on fait 4 rectangles autour du cadre pour assombrir */
          background:
            linear-gradient(#000000b3, #000000b3) top / 100% calc((100% - var(--box-h)) / 2),
            linear-gradient(#000000b3, #000000b3) bottom / 100% calc((100% - var(--box-h)) / 2),
            linear-gradient(#000000b3, #000000b3) left / calc((100% - var(--box-w)) / 2) var(--box-h),
            linear-gradient(#000000b3, #000000b3) right / calc((100% - var(--box-w)) / 2) var(--box-h);
          background-repeat: no-repeat;
        }
        .scan-box {
          width: var(--box-w);
          height: var(--box-h);
          border-radius: 12px;
          outline: 2px dashed rgba(255, 255, 255, 0.8);
          outline-offset: -6px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0); /* clics passifs */
        }
        .scan-line {
          position: absolute;
          left: 10px;
          right: 10px;
          height: var(--line);
          background: linear-gradient(90deg, transparent, #ff2845, transparent);
          top: 12px;
          border-radius: 999px;
          animation: sweep 1.6s linear infinite;
          box-shadow: 0 0 8px #ff2845, 0 0 2px #ff2845 inset;
        }
        @keyframes sweep {
          0% {
            top: 12px;
          }
          100% {
            top: calc(100% - 12px);
          }
        }
      `}</style>
    </div>
  );
}
