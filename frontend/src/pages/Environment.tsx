import { useEffect, useRef } from "react";

declare global {
  interface Window {
    createUnityInstance: any;
    unityDiagnostics: any;
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

    const unityShowBanner = (msg: string, type?: "error" | "warning") => {
      if (!warningRef.current) return;

      const div = document.createElement("div");
      div.innerHTML = msg;
      // div.style.padding = "10px";

      if (type === "error") div.style.background = "red";
      if (type === "warning") div.style.background = "yellow";

      warningRef.current.appendChild(div);

      if (type !== "error") {
        setTimeout(() => {
          div.remove();
        }, 5000);
      }
    };

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

    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes";
      document.head.appendChild(meta);

      canvas.className = "unity-mobile";
    } else {
      canvas.style.width = "100%";
      canvas.style.height = "100vh";
    }

    if (loadingBarRef.current) {
      loadingBarRef.current.style.display = "block";
    }

    const script = document.createElement("script");
    script.src = loaderUrl;
    script.async = true;

    script.onload = () => {
      window
        .createUnityInstance(canvas, config, (progress: number) => {
          if (progressBarRef.current) {
            progressBarRef.current.style.width = `${progress * 100}%`;
          }
        })
        .then((unityInstance: any) => {
          if (loadingBarRef.current) {
            loadingBarRef.current.style.display = "none";
          }

          if (fullscreenBtnRef.current) {
            fullscreenBtnRef.current.onclick = () => {
              unityInstance.SetFullscreen(1);
            };
          }

          if (diagnosticsIconRef.current) {
            diagnosticsIconRef.current.onclick = () => {
              window.unityDiagnostics.openDiagnosticsDiv(
                unityInstance.GetMetricsInfo
              );
            };
          }
        })
        .catch(alert);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
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
          // width: "100%",
          // height: "100vh",
          background: "#231F20",
        }}
      ></canvas>
    </div>
  );
};

export default UnityPlayer;
