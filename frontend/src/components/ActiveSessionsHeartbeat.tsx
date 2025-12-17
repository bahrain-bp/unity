import { useEffect } from "react";
import { ImageClient } from "../services/api";

export const useActiveUserHeartbeat = () => {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await ImageClient.post("/active-sessions");
      } catch (err: any) {
        console.error("Active sessions heartbeat error:", err.response?.data?.error || err.message);
      }
    };

    // Send immediately and then every 30s
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    // Optional: clear interval on unmount
    return () => clearInterval(interval);
  }, []);
};
