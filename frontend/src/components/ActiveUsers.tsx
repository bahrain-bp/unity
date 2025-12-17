import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";

export default function ActiveUsers() {
  const ws = useWebSocket();
  const [activeUsers, setActiveUsers] = useState(0);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.card === "active_sessions") {
        setActiveUsers(data.data.count);
      }
    };

    ws.addEventListener("message", handleMessage);

    return () => ws.removeEventListener("message", handleMessage);
  }, [ws]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">
          <Users size={28} />
        </div>
        <div className="card-title">Real-time Active Visitors</div>
      </div>
      <div className="card-value">{activeUsers}</div>
    </div>
  );
}
