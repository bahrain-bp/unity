import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { FeedbackClient } from "../../services/api";

interface AvgFeedbackData {
  avg_score: number;
  colored_stars: number;
  empty_stars: number;
}

interface LoadDashboardResponse {
  card: string;
  data: AvgFeedbackData[];
}

export default function AvgFeedbackScore() {
  const [feedback, setFeedback] = useState<AvgFeedbackData>({
    avg_score: 0,
    colored_stars: 0,
    empty_stars: 5,
  });
  const [connected, setConnected] = useState<boolean>(false);

  // Fetch initial feedback
  const fetchFeedback = async () => {
    try {
      const { data } = await FeedbackClient.post<LoadDashboardResponse>(
        "/admin/loadFeedback",
        { component: "avg_feedback_score" }
      );

      if (data.card === "avg_feedback_score" && Array.isArray(data.data) && data.data.length > 0) {
        setFeedback(data.data[0]); // pick first element from the array
      }
    } catch (err) {
      console.error("Error fetching feedback:", err);
    }
  };

  useEffect(() => {
    fetchFeedback();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.card === "avg_feedback_score" && data.data) {
          setFeedback({
            avg_score: data.data.avg_score,
            colored_stars: data.data.colored_stars,
            empty_stars: data.data.empty_stars,
          });
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < feedback.colored_stars; i++) {
      stars.push(
        <Star key={`filled-${i}`} color="#ff7614" size={18} fill="#ff7614" />
      );
    }
    for (let i = 0; i < feedback.empty_stars; i++) {
      stars.push(<Star key={`empty-${i}`} color="#e5e7eb" size={18} />);
    }
    return stars;
  };

  return (
    <div className="dashboard-card feedback-theme">
      <div className="card-header">
        <div className="card-icon">
          <Star size={30} color="#ff7614" />
        </div>
        <div className="card-title">
          Avg. Feedback Score
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>
      <div className="card-value">{feedback.avg_score}</div>
      <div className="star-container">{renderStars()}</div>
    </div>
  );
}
