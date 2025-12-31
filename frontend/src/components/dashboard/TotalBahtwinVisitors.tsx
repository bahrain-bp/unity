import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ImageClient } from "../../services/api";

interface TotalVisitorsResponse {
  card: string;
  data: { total_visitors: number }[];
}

export default function TotalBahtwinVisitors() {
  const [totalVisitors, setTotalVisitors] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch total visitors on load
  const fetchTotalVisitors = async () => {
    try {
      const { data } = await ImageClient.post<TotalVisitorsResponse>(
        "/admin/loadDashboard",
        { component: "total_bahtwin_visitors" } // send component name
      );

      if (
        data.card === "total_bahtwin_visitors" &&
        Array.isArray(data.data) &&
        data.data.length > 0
      ) {
        setTotalVisitors(data.data[0].total_visitors); // pick first element
      }
    } catch (err) {
      console.error("Error fetching total visitors:", err);
    }
  };

  useEffect(() => {
    fetchTotalVisitors();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.card === "total_bahtwin_visitors") {
          setTotalVisitors(data.data.total_visitors);
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
          <Users size={30} />
        </div>
        <div className="card-title">
          Total BAHTWIN Users
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>
      <div className="card-value">{totalVisitors}</div>
    </div>
  );
}
