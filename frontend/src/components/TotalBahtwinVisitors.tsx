import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import "../../sass/DashboardCards.scss";

export default function TotalBahtwinVisitors() {
  const [totalVisitors, setTotalVisitors] = useState<number>(0);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
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
    <>
      <div className="card-header total-visitor">
        <div className="card-icon">
          <Users size={30} />
        </div>

        <div className="card-title">
          Total BAHTWIN Visitors
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>

      <div className="card-value">{totalVisitors}</div>
    </>
  );
}
