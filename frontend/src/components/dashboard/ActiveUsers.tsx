import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { ImageClient } from "../../services/api";

interface ActiveUsersNowResponse {
  card: string;
  data: {
    count: number;
    timestamp: number;
  }[];
}

export default function ActiveUsersNow() {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  // Initial load (same as InvitationsToday)
  const fetchActiveUsers = async () => {
    try {
      const { data } = await ImageClient.post<ActiveUsersNowResponse>(
        "/admin/loadDashboard",
        { component: "active_users_now" }
      );

      if (
        data.card === "active_users_now" &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        setActiveUsers(data.data[0].count);
        setLastUpdated(data.data[0].timestamp);
      }
    } catch (err) {
      console.error("Error fetching active users:", err);
    }
  };

  useEffect(() => {
    fetchActiveUsers();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.card === "active_users_now") {
          setActiveUsers(data.data.count);
          setLastUpdated(data.data.timestamp);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString();

  return (
    <div className="dashboard-card active-users-theme">
      <div className="card-header">
        <div className="card-icon">
          <User size={30} color="#ff7614" />
        </div>

        <div className="card-title">
          Online Users Now
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>

      <div className="card-value">{activeUsers}</div>

      <div className="card-subtext">
        Updated at: {lastUpdated ? formatTime(lastUpdated) : "--"}
      </div>
    </div>
  );
}
