import { useEffect, useState } from "react";
import { Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ImageClient } from "../../services/api";

interface UsersTodayData {
  count: number;
  usersYesterday: number;
  usersTodayChangePct: number;
  timezone: string;
}

interface UsersTodayResponse {
  card: string;
  data: UsersTodayData;
}

export default function UsersTodayContent() {
  const [data, setData] = useState<UsersTodayData | null>(null);
  const [connected, setConnected] = useState(false);

  const fetchUsersToday = async () => {
    try {
      const response = await ImageClient.post<UsersTodayResponse>(
        "/admin/loadDashboard",
        { component: "users_today" }
      );

      if (response?.data?.card === "users_today" && response.data.data) {
        setData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching users today:", err);
    }
  };

  useEffect(() => {
    fetchUsersToday();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.card === "users_today" && msg.data) {
          setData(msg.data);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  const isPositive = (data?.usersTodayChangePct ?? 0) >= 0;

  // Safe defaults if data not loaded yet
  const count = data?.count ?? 0;
  const deltaPct = data?.usersTodayChangePct ?? 0;
  const usersYesterday = data?.usersYesterday ?? 0;
  const timezone = data?.timezone ?? "";

  return (
    <div className="dashboard-card users-today-theme">
      {/* Card header always shows */}
      <div className="card-header">
        <div className="card-icon">
          <Users size={30} color="#ff7614" />
        </div>
        <div className="card-title">
          Users Today
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>

      {/* Main number */}
      <div className="card-value">{count.toLocaleString()}</div>

      {/* Delta + Footer */}
      <div className="card-bottom-row">
        <div className={`card-delta-footer ${isPositive ? "positive" : "negative"}`}>
          {isPositive ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          <span className="delta-text">{Math.abs(deltaPct).toFixed(1)}% vs yesterday</span>
          <span className="footer-text">
            · Yesterday: {usersYesterday.toLocaleString()} · {timezone}
          </span>
        </div>
      </div>
    </div>
  );
}
