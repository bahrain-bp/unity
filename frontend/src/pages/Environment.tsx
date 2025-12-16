import { useEffect, useRef } from "react";

declare global {
  interface Window {
    createUnityInstance: any;
  }
}

const UnityPlayer = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const unityContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const unityShowBanner = (msg: string, type?: "error" | "warning") => {
      const warningBanner = document.querySelector(
        "#unity-warning"
      ) as HTMLDivElement;

      const updateBannerVisibility = () => {
        warningBanner.style.display = warningBanner.children.length
          ? "block"
          : "none";
      };

      const div = document.createElement("div");
      div.innerHTML = msg;
      warningBanner.appendChild(div);

      if (type === "error") {
        div.style.cssText = "background:red;padding:10px;";
      } else {
        if (type === "warning") {
          div.style.cssText = "background:yellow;padding:10px;";
        }
        setTimeout(() => {
          warningBanner.removeChild(div);
          updateBannerVisibility();
        }, 5000);
      }

      updateBannerVisibility();
    };

    const buildUrl = "/unity";
    const loaderUrl = `${buildUrl}/BAHTWIN_Unity_V2.loader.js`;

    const config = {
      arguments: [],
      dataUrl: `${buildUrl}/BAHTWIN_Unity_V2.data.unityweb`,
      frameworkUrl: `${buildUrl}/BAHTWIN_Unity_V2.framework.js.unityweb`,
      codeUrl: `${buildUrl}/BAHTWIN_Unity_V2.wasm.unityweb`,
      streamingAssetsUrl: "StreamingAssets",
      companyName: "DefaultCompany",
      productName: "BAHTWIN_Unity",
      productVersion: "0.1.0",
      showBanner: unityShowBanner,
    };

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      const meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content =
        "width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes";
      document.head.appendChild(meta);

      unityContainerRef.current?.classList.add("unity-mobile");
      canvas.classList.add("unity-mobile");
    } else {
      canvas.style.width = "100%";
      canvas.style.height = "100vh";
      // canvas.style.position = "fixed";
    }

    const loadingBar = document.querySelector(
      "#unity-loading-bar"
    ) as HTMLDivElement;
    const progressBar = document.querySelector(
      "#unity-progress-bar-full"
    ) as HTMLDivElement;
    const fullscreenButton = document.querySelector(
      "#unity-fullscreen-button"
    ) as HTMLDivElement;

    loadingBar.style.display = "block";

    const script = document.createElement("script");
    script.src = loaderUrl;

    script.onload = () => {
      window
        .createUnityInstance(canvas, config, (progress: number) => {
          progressBar.style.width = `${progress * 100}%`;
        })
        .then((unityInstance: any) => {
          loadingBar.style.display = "none";
          fullscreenButton.onclick = () => {
            unityInstance.SetFullscreen(1);
          };
        })
        .catch((message: string) => {
          alert(message);
        });
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div id="unity-container" className="unity-desktop" ref={unityContainerRef}>
      <canvas
        ref={canvasRef}
        id="unity-canvas"
        // width={960}
        // height={600}
        tabIndex={-1}
        style={{
          width: "100%",
          height: "100vh",
          background: "#231F20",
        }}
      ></canvas>

      <div id="unity-loading-bar">
        <div id="unity-logo" />
        <div id="unity-progress-bar-empty">
          <div id="unity-progress-bar-full" />
        </div>
      </div>

      <div id="unity-warning" />

      <div id="unity-footer">
        <div id="unity-logo-title-footer" />
        <div id="unity-fullscreen-button" />
        <div id="unity-build-title">BAHTWIN_Unity</div>
      </div>
    </div>
  );
};

export default UnityPlayer;
