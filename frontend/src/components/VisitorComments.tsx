import { useState, useEffect } from "react";
import "../../sass/DashboardCards.scss";
import { FeedbackClient } from "../services/api";

interface Comment {
  comment: string;
}

interface LoadDashboardResponse {
  card: string;
  data: Comment[];
}

export default function VisitorComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch initial comments
  const fetchComments = async () => {
    try {
      const { data } = await FeedbackClient.post<LoadDashboardResponse>(
        "/admin/loadFeedback",
        { component: "visitor_comment" } // send component name
      );

      if (data.card === "visitor_comment" && Array.isArray(data.data)) {
        // reverse to show latest first
        setComments(data.data.reverse());
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
    }
  };

  useEffect(() => {
    fetchComments();

    // Open WebSocket for real-time comments
    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.card === "visitor_comment" && data.data?.comment) {
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
              <p>{typeof c === "string" ? c : c.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
