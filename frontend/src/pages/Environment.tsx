import { useEffect, useRef } from "react";
import Spinner from "../components/Spinner";

declare global {
  interface Window {
    createUnityInstance: any;
    unityDiagnostics: any;
    unityInstance?: any;
    initSmartPlugBridge?: (instance: any) => void;
    initChatBridge?: (instance: any) => void;
  }
}

const UnityPlayer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingBarRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const fullscreenBtnRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsIconRef = useRef<HTMLImageElement | null>(null);
  const warningRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // ─────────────────────────────────────────────
    // Unity banner (errors / warnings)
    // ─────────────────────────────────────────────
    const unityShowBanner = (msg: string, type?: "error" | "warning") => {
      if (!warningRef.current) return;

      const div = document.createElement("div");
      div.innerHTML = msg;

      if (type === "error") div.style.background = "red";
      if (type === "warning") div.style.background = "yellow";

      warningRef.current.appendChild(div);

      if (type !== "error") {
        setTimeout(() => div.remove(), 5000);
      }
    };

    // ─────────────────────────────────────────────
    // Unity build config
    // ─────────────────────────────────────────────
    const buildUrl = "/unity";
    const loaderUrl = `${buildUrl}/BAHTWIN_BUILD.loader.js`;

    const config = {
      arguments: [],
      dataUrl: `${buildUrl}/BAHTWIN_BUILD.data.gz`,
      frameworkUrl: `${buildUrl}/BAHTWIN_BUILD.framework.js.gz`,
      codeUrl: `${buildUrl}/BAHTWIN_BUILD.wasm.gz`,
      streamingAssetsUrl: "StreamingAssets",
      companyName: "BAHTWIN_GAMEON_UNITY",
      productName: "BAHTWIN_Unity",
      productVersion: "0.1.0",
      showBanner: unityShowBanner,
    };

    // ─────────────────────────────────────────────
    // Mobile handling
    // ─────────────────────────────────────────────
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes";
      document.head.appendChild(meta);

      canvas.className = "unity-mobile";
      canvas.style.width = "100%";
      canvas.style.height = "100vh";
      document.body.style.textAlign = "left";
    } else {
      canvas.style.width = "100%";
      canvas.style.height = "100vh";
    }

    if (loadingBarRef.current) {
      loadingBarRef.current.style.display = "block";
    }

    // ─────────────────────────────────────────────
    // Load Unity loader script
    // ─────────────────────────────────────────────
    const unityLoaderScript = document.createElement("script");
    unityLoaderScript.src = loaderUrl;
    unityLoaderScript.async = true;

    unityLoaderScript.onload = () => {
      window
        .createUnityInstance(canvas, config, (progress: number) => {
          if (progressBarRef.current) {
            progressBarRef.current.style.width = `${progress * 100}%`;
          }
        })
        .then((unityInstance: any) => {
          // Hide loading UI
          if (loadingBarRef.current) {
            loadingBarRef.current.style.display = "none";
          }

          // Expose globally
          window.unityInstance = unityInstance;

          // Fullscreen
          if (fullscreenBtnRef.current) {
            fullscreenBtnRef.current.onclick = () => {
              unityInstance.SetFullscreen(1);
            };
          }

          // Diagnostics
          if (diagnosticsIconRef.current && window.unityDiagnostics) {
            diagnosticsIconRef.current.onclick = () => {
              window.unityDiagnostics.openDiagnosticsDiv(
                unityInstance.GetMetricsInfo
              );
            };
          }

          // ─────────────────────────────────────────────
          // Initialize external bridges
          // ─────────────────────────────────────────────
          if (window.initSmartPlugBridge) {
            console.log("Initializing SmartPlug bridge…");
            window.initSmartPlugBridge(unityInstance);
          } else {
            console.warn(
              "initSmartPlugBridge not found. Is unity-realtime-bridge.js loaded?"
            );
          }

          if (window.initChatBridge) {
            console.log("Initializing Chat bridge…");
            window.initChatBridge(unityInstance);
          } else {
            console.warn(
              "initChatBridge not found. Is unity-realtime-bridge.js loaded?"
            );
          }
        })
        .catch(alert);
    };

    document.body.appendChild(unityLoaderScript);

    // ─────────────────────────────────────────────
    // Load bridge script
    // ─────────────────────────────────────────────
    const bridgeScript = document.createElement("script");
    bridgeScript.src = "/js/unity-realtime-bridge.js";
    bridgeScript.async = true;
    document.body.appendChild(bridgeScript);

    // ─────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────
    return () => {
      unityLoaderScript.remove();
      bridgeScript.remove();
    };
  }, []);

  return (
    <div id="unity-container" className="unity-desktop">
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        tabIndex={-1}
        style={{ background: "#231F20" }}
      />

      <div ref={loadingBarRef} id="unity-loading-bar">
        <Spinner />
        <p>Loading 3D Environment...</p>
        <div id="unity-progress-bar-empty">
          <div ref={progressBarRef} id="unity-progress-bar-full" />
        </div>
      </div>
    </div>
  );
};

export default UnityPlayer;
