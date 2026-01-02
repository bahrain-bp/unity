import { useEffect, useRef } from "react";

export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Load the Unity loader script dynamically
    const script = document.createElement("script");
    script.src = "/whiteboard/whiteboard.loader.js";
    script.onload = () => {
      if ((window as any).createUnityInstance && canvasRef.current) {
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
        (window as any)
          .createUnityInstance(canvasRef.current, {
            arguments: [],
            dataUrl: "/whiteboard/whiteboard.data.unityweb",
            frameworkUrl: "/whiteboard/whiteboard.framework.js.unityweb",
            codeUrl: "/whiteboard/whiteboard.wasm.unityweb",
            streamingAssetsUrl: "StreamingAssets",
            companyName: "DefaultCompany",
            productName: "BAHTWIN_Unity",
            productVersion: "0.1.0",
          })
          .catch((message: any) => alert(message));
      }
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
        // width={960}
        // height={600}
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
