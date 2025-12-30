// src/context/WebSocketContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const WebSocketContext = createContext<WebSocket | null>(null);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket("wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"); // Lambda WS API Gateway URL

    socket.onopen = () => console.log("WebSocket connected");
    socket.onclose = () => console.log("WebSocket disconnected");
    socket.onerror = (err) => console.error("WebSocket error", err);

    setWs(socket);

    // Heartbeat: keep WS connection alive
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action: "heartbeat" }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      socket.close();
    };
  }, []);

  return <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>;
};

export const useWebSocket = () => useContext(WebSocketContext);
