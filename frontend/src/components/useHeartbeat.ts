import { useEffect } from "react";
import { Client } from "../services/api";

export function useHeartbeat(userId: string) {
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await Client.post("/visitor/heartbeat", { userId });
        // optionally, you can handle the response here
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    };

    sendHeartbeat(); // initial call
    const interval = setInterval(sendHeartbeat, 30000); // repeat every 30s

    return () => clearInterval(interval);
  }, [userId]);
}
