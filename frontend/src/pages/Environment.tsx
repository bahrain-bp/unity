import { useEffect, useRef } from "react";

export default function Environment() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // --- Unity loader script ---
    const loaderScript = document.createElement("script");
    loaderScript.src = "/unity/BAHTWIN_BUILD.loader.js";
    loaderScript.onload = () => {
      const w = window as any;

      if (w.createUnityInstance && canvasRef.current) {
        // Mobile adjustments
        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
          const meta = document.createElement("meta");
          meta.name = "viewport";
          meta.content =
            "width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes";
          document.head.appendChild(meta);

          const canvas = canvasRef.current;
          canvas.style.width = "100%";
          canvas.style.height = "100vh";
          // canvas.style.position = "fixed";
          document.body.style.textAlign = "left";
        }

        // Create Unity instance
        w
          .createUnityInstance(canvasRef.current, {
            arguments: [],
            dataUrl: "/unity/BAHTWIN_BUILD.data.unityweb",
            frameworkUrl: "/unity/BAHTWIN_BUILD.framework.js.unityweb",
            codeUrl: "/unity/BAHTWIN_BUILD.wasm.unityweb",
            streamingAssetsUrl: "StreamingAssets",
            companyName: "DefaultCompany",
            productName: "BAHTWIN_Unity",
            productVersion: "0.1.0",
          })
          .then((instance: any) => {
            console.log("Unity instance ready");
            // expose globally (optional, but useful)
            w.unityInstance = instance;

            // Initialize Smart Plug bridge if it’s loaded
            if (w.initSmartPlugBridge) {
              console.log("Initializing SmartPlug bridge…");
              w.initSmartPlugBridge(instance);
            } else {
              console.warn(
                "initSmartPlugBridge not found. Is /js/unity-realtime-bridge.js loaded?"
              );
            }
          })
          .catch((message: any) => {
            console.error("Unity load error:", message);
            alert(message);
          });
      }
    };

    document.body.appendChild(loaderScript);

    // --- Smart Plug bridge script (/public/js/unity-smartplug-bridge.js) ---
    const bridgeScript = document.createElement("script");
    bridgeScript.src = "/js/unity-realtime-bridge.js";
    document.body.appendChild(bridgeScript);

    // ─────────────────────────────────────────────
    // Cleanup (user leaves page)
    // ─────────────────────────────────────────────
    return () => {
      if (loaderScript.parentNode) {
        loaderScript.parentNode.removeChild(loaderScript);
      }
      if (bridgeScript.parentNode) {
        bridgeScript.parentNode.removeChild(bridgeScript);
      }
    };
  }, []);

  return (
    <div
      style={{
        textAlign: "center",
        padding: 0,
        border: 0,
        margin: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        tabIndex={-1}
        style={{
          width: "100%",
          height: "100vh",
          background: "#231F20",
        }}
      ></canvas>
    </div>
  );
}
