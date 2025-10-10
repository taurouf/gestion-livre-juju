// components/IsbnScanner.js
"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function IsbnScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  const [error, setError] = useState("");

  const stopAll = () => {
    try {
      if (readerRef.current) {
        readerRef.current.reset();
        readerRef.current = null;
      }
      const stream = videoRef.current?.srcObject;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    } catch {}
    setRunning(false);
  };

  useEffect(() => {
    return () => stopAll();
  }, []);

  async function startScan() {
    setError("");
    setRunning(true);

    // --- 1) API native BarcodeDetector si dispo ---
    let formats = [];
    try {
      if (
        "BarcodeDetector" in window &&
        typeof window.BarcodeDetector.getSupportedFormats === "function"
      ) {
        formats = await window.BarcodeDetector.getSupportedFormats();
      }
    } catch {
      // on ignore
    }
    const supportsEAN13 = formats.includes("ean-13") || formats.includes("ean_13");

    if ("BarcodeDetector" in window && supportsEAN13) {
      setUsingNative(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector({ formats: ["ean-13"] });

        let raf;
        const loop = async () => {
          try {
            const barcodes = await detector.detect(videoRef.current);
            const isbn = barcodes?.[0]?.rawValue?.replace(/\D/g, "");
            if (isbn && isIsbnLike(isbn)) {
              onDetected?.(normalizeIsbn(isbn));
              stopAll();
              onClose?.();
              return;
            }
          } catch {
            /* ignore */
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
        return;
      } catch (e) {
        console.warn("BarcodeDetector failed, fallback to ZXing", e);
        stopAll();
      }
    }

    // --- 2) Fallback ZXing ---
    setUsingNative(false);
    startZxing();
  }

  async function startZxing() {
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCam =
        devices.find((d) => /back|rear|trou|arrière/i.test(d.label))?.deviceId ??
        devices[0]?.deviceId;

      await reader.decodeFromVideoDevice(
        backCam || null,
        videoRef.current,
        (result, err, controls) => {
          if (result) {
            const raw = result.getText();
            const digits = raw.replace(/\D/g, "");
            if (isIsbnLike(digits)) {
              onDetected?.(normalizeIsbn(digits));
              controls.stop();
              stopAll();
              onClose?.();
            }
          } else if (err) {
            // NotFoundException = normal quand rien n'est vu -> on ignore
            if (err?.name && err.name !== "NotFoundException") {
              console.warn(err);
            }
          }
        }
      );
      setRunning(true);
    } catch (e) {
      console.error(e);
      setError("Impossible d’accéder à la caméra.");
      setRunning(false);
    }
  }

  function isIsbnLike(d) {
    return /^\d{13}$/.test(d) && (d.startsWith("978") || d.startsWith("979"));
  }
  function normalizeIsbn(d) {
    return d.slice(0, 13);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl ring-1 ring-brand-100 overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <h3 className="font-semibold text-brand-900">
            Scanner ISBN {usingNative ? "(rapide)" : "(compatibilité)"}
          </h3>
          <button
            onClick={() => {
              stopAll();
              onClose?.();
            }}
            className="px-3 py-1.5 rounded-xl ring-1 ring-brand-200 hover:bg-brand-50 text-brand-900"
          >
            Fermer
          </button>
        </div>

        <div className="px-4 pb-3">
          <div className="rounded-xl overflow-hidden ring-1 ring-brand-100 bg-black">
            <video ref={videoRef} className="w-full h-64 object-cover" playsInline muted />
          </div>

          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}

          <div className="mt-3 flex gap-2">
            {!running ? (
              <button
                onClick={startScan}
                className="flex-1 bg-brand-600 hover:bg-brand-900 text-white rounded-2xl px-4 py-2"
              >
                Démarrer
              </button>
            ) : (
              <button
                onClick={stopAll}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl px-4 py-2"
              >
                Arrêter
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-brand-700">
            Astuce : cadre le code-barres EAN-13 (978/979). Lumière suffisante = scan plus rapide.
          </p>
        </div>
      </div>
    </div>
  );
}
