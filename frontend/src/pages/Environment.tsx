import { useEffect, useRef } from "react";

export default function Environment() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // ─────────────────────────────────────────────
    // Open WebSocket (presence tracking)
    // ─────────────────────────────────────────────
const ws = new WebSocket(
  "wss://46fbojq009.execute-api.us-east-1.amazonaws.com/prod?role=visitor"
);
//remove this, later, and add the websocket url in env 
// this websocket url is for visitor presence tracking

    ws.onopen = () => {
      console.log("✅ WebSocket connected (user is active)");
    };

    ws.onclose = () => {
      console.log("❌ WebSocket disconnected (user left)");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    wsRef.current = ws;

    // ─────────────────────────────────────────────
    //  Load Unity WebGL
    // ─────────────────────────────────────────────
    const script = document.createElement("script");
    script.src = "/unity/Bahtwin_Unity_version1.loader.js";

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
          document.body.style.textAlign = "left";
        }

        // Create Unity instance
        (window as any)
          .createUnityInstance(canvasRef.current, {
            arguments: [],
            dataUrl: "/unity/Bahtwin_Unity_version1.data.unityweb",
            frameworkUrl: "/unity/Bahtwin_Unity_version1.framework.js.unityweb",
            codeUrl: "/unity/Bahtwin_Unity_version1.wasm.unityweb",
            streamingAssetsUrl: "StreamingAssets",
            companyName: "DefaultCompany",
            productName: "BAHTWIN_Unity",
            productVersion: "0.1.0",
          })
          .catch((message: any) => alert(message));
      }
    };

    document.body.appendChild(script);

    // ─────────────────────────────────────────────
    // Cleanup (user leaves page)
    // ─────────────────────────────────────────────
    return () => {
      if (wsRef.current) {
        wsRef.current.close(); // triggers $disconnect
      }
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
          width: "100%",
          height: "100vh",
          background: "#231F20",
        }}
      />
    </div>
  );
}
