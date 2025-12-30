import { useState, useEffect } from "react";
import "../../sass/DashboardCards.scss";

interface ActiveUsersData {
  count: number;
  timestamp: number;
}

interface LoadDashboardResponse {
  card: string;
  data: ActiveUsersData;
}

export default function ActiveUsersNow() {
  const [activeUsers, setActiveUsers] = useState<ActiveUsersData>({
    count: 0,
    timestamp: 0,
  });
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch initial active users
  const fetchActiveUsers = async () => {
    try {
      const response = await fetch("/admin/loadActiveUsers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component: "active_users_now" }),
      });

      const data: LoadDashboardResponse = await response.json();

      if (data.card === "active_users_now" && data.data) {
        setActiveUsers(data.data);
      }
    } catch (err) {
      console.error("Error fetching active users:", err);
    }
  };

  useEffect(() => {
    fetchActiveUsers();

    const ws = new WebSocket(`${wsAPI}?token=${wsToken}`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data: LoadDashboardResponse = JSON.parse(event.data);

        if (data.card === "active_users_now" && data.data) {
          setActiveUsers(data.data);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  // Format timestamp to human-readable time if needed
  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleTimeString();
  };

  return (
    <div className="dashboard-card active-users-theme">
      <div className="card-header">
        <div className="card-icon">👤</div>
        <div className="card-title">
          Active Visitors Now
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>
      <div className="card-value">{activeUsers.count}</div>
      <div className="card-subtext">
        Updated at: {activeUsers.timestamp ? formatTime(activeUsers.timestamp) : "--"}
      </div>
    </div>
  );
}
