import { useState, useEffect } from "react";
import "../../sass/DashboardCards.scss";

export default function VisitorComments() {
  const [comments, setComments] = useState<string[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Parsed WS message:", data);

        if (data.card === "visitor_comment") {
          // Append new comment to the list
          setComments((prev) => [data.data.comment, ...prev]);
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
          Visitor Comments
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>
      <div className="comments-box">
        {comments.length === 0 ? (
          <p>No comments yet</p>
        ) : (
          comments.map((c, idx) => (
            <div key={idx} className="comment-item">
              <p>{c}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
