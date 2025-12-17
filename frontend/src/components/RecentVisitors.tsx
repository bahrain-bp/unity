import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import "../../sass/DashboardCards.scss";

interface Visitor {
  visitor_name: string;
  checkin_time: string;
}

export default function RecentVisitors() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          data.card === "visitor_checkin" &&
          data.data?.visitor_name &&
          data.data?.checkin_time
        ) {
          setVisitors(prev => [
            { visitor_name: data.data.visitor_name, checkin_time: data.data.checkin_time },
            ...prev
          ]);
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
    <div className="dashboard-card comments-theme">
      <div className="card-header">
        <div className="card-title">
          Recent Visitors
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>
      <div className="comments-box">
        {visitors.length === 0 ? (
          <p>No visitors yet</p>
        ) : (
          visitors.map((v, idx) => (
            <div key={idx} className="comment-item">
              <p>{v.visitor_name} checked in at {v.checkin_time}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
