"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type BarcodeScannerProps = {
  targetInputId: string;
  buttonLabel?: string;
};

export function BarcodeScanner({
  targetInputId,
  buttonLabel = "Scan barcode",
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopScanning = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
      readerRef.current = null;
    };
  }, []);

  const writeValueToTarget = (value: string) => {
    const input = document.getElementById(targetInputId) as HTMLInputElement | null;
    if (!input) {
      setError(`Could not find input #${targetInputId}`);
      return;
    }
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const startScanning = async () => {
    if (isScanning) {
      return;
    }

    if (!videoRef.current) {
      setError("Scanner video element is not ready.");
      return;
    }

    setError(null);

    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, scanError, callbackControls) => {
          if (result) {
            writeValueToTarget(result.getText());
            callbackControls.stop();
            controlsRef.current = null;
            setIsScanning(false);
          }

          if (scanError && scanError.name !== "NotFoundException") {
            setError(scanError.message);
          }
        },
      );

      controlsRef.current = controls;
      setIsScanning(true);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Unable to start camera scanning.";
      setError(message);
      stopScanning();
    }
  };

  return (
    <div className="scanner">
      <button
        className="button button--secondary"
        type="button"
        onClick={isScanning ? stopScanning : startScanning}
      >
        {isScanning ? "Stop scanner" : buttonLabel}
      </button>
      <video className="scanner__video" ref={videoRef} muted playsInline />
      {error ? <p className="text-error">{error}</p> : null}
    </div>
  );
}
