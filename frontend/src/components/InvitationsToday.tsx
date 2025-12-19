import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import "../../sass/DashboardCards.scss";
import { ImageClient } from "../services/api";

interface InvitationsTodayResponse {
  card: string;
  data: { total: number }[];
}

export default function InvitationsToday() {
  const [totalInvites, setTotalInvites] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch today invitations on load
  const fetchTodayInvitations = async () => {
    try {
      const { data } = await ImageClient.post<InvitationsTodayResponse>(
        "/admin/loadDashboard",
        { component: "today_invitations" }
      );

      if (
        data.card === "today_invitations" &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        setTotalInvites(data.data[0].total);
      }
    } catch (err) {
      console.error("Error fetching today invitations:", err);
    }
  };

  useEffect(() => {
    fetchTodayInvitations();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.card === "today_invitations") {
          setTotalInvites(data.data.total);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  return (
    <div className="dashboard-card total-visitor">
      <div className="card-header">
        <div className="card-icon">
          <Mail size={30} />
        </div>

        <div className="card-title">
          Invitees Today
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>

      <div className="card-value">{totalInvites}</div>
    </div>
  );
}
