import { useEffect, useRef } from "react";

export default function SmartPlugEnvironment() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // --- Load Unity loader for YOUR test build ---
    const loaderScript = document.createElement("script");
    loaderScript.src = "/smartplug-test/Downloads.loader.js";

    loaderScript.onload = () => {
      const w = window as any;

      if (w.createUnityInstance && canvasRef.current) {
        w
          .createUnityInstance(canvasRef.current, {
            arguments: [],
            dataUrl: "/smartplug-test/Downloads.data",
            frameworkUrl: "/smartplug-test/Downloads.framework.js",
            codeUrl: "/smartplug-test/Downloads.wasm",
            streamingAssetsUrl: "StreamingAssets",
            companyName: "DefaultCompany",
            productName: "SmartPlugTest",
            productVersion: "0.1.0",
          })
          .then((instance: any) => {
            console.log("[SmartPlugTest] Unity instance ready");
            w.unityInstance = instance;

            // Initialize the smart plug bridge (from /public/js/unity-realtime-bridge.js)
            if (w.initSmartPlugBridge) {
              console.log("[SmartPlugTest] Initializing SmartPlug bridge…");
              w.initSmartPlugBridge(instance);
            } else {
              console.warn(
                "[SmartPlugTest] initSmartPlugBridge not found. Is /js/unity-realtime-bridge.js loaded?"
              );
            }
          })
          .catch((err: any) => {
            console.error("[SmartPlugTest] Unity load error:", err);
            alert(err);
          });
      }
    };

    document.body.appendChild(loaderScript);

    // --- Load your existing SmartPlug bridge script ---
    const bridgeScript = document.createElement("script");
    bridgeScript.src = "/js/unity-realtime-bridge.js";
    document.body.appendChild(bridgeScript);

    return () => {
      if (loaderScript.parentNode) loaderScript.parentNode.removeChild(loaderScript);
      if (bridgeScript.parentNode) bridgeScript.parentNode.removeChild(bridgeScript);
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
        id="unity-canvas-smartplug"
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
