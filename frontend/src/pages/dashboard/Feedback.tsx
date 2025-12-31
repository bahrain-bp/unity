import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FeedbackCard } from "../../components/dashboard/FeedbackCard";
import { FeedbackClient } from "../../services/api";
import DashboardLayout from "./DashboardLayout";

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true); // <-- add loading state

  useEffect(() => {
    async function fetchFeedbacks() {
      try {
        const response = await FeedbackClient.get("/admin/getFeedback");
        setFeedbacks(response.data);
      } catch (error) {
        console.error("Failed to fetch feedbacks:", error);
        setFeedbacks([]);
      } finally {
        setLoading(false); // <-- mark loading complete
      }
    }

    fetchFeedbacks();
  }, []);

  const filteredFeedbacks = feedbacks.filter((fb) => {
    const matchesSearch = fb.name?.toLowerCase().includes(search.toLowerCase());
    const matchesRating = filterRating === "" || fb.overallRating === Number(filterRating);

    const feedbackDate = new Date(fb.createdAt);
    const matchesStart = startDate ? feedbackDate >= startDate : true;
    const matchesEnd = endDate ? feedbackDate <= endDate : true;

    return matchesSearch && matchesRating && matchesStart && matchesEnd;
  });

  if (loading) {
    return (
      <DashboardLayout className="feedback-page" header="BAHTWIN Feedback">
        <p className="empty-state">Loading feedbacks...</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout className="feedback-page" header="BAHTWIN Feedback">
      <div className="controls">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value)}
        >
          <option value="">All Satisfaction Levels</option>
          <option value="5">★★★★★</option>
          <option value="4">★★★★</option>
          <option value="3">★★★</option>
          <option value="2">★★</option>
          <option value="1">★</option>
        </select>

        <DatePicker
          selected={startDate}
          onChange={(date: any) => setStartDate(date)}
          placeholderText="Start Date"
          className="date-picker-input"
          dateFormat="MM/dd/yyyy"
        />

        <DatePicker
          selected={endDate}
          onChange={(date: any) => setEndDate(date)}
          placeholderText="End Date"
          className="date-picker-input"
          dateFormat="MM/dd/yyyy"
        />
      </div>

      <div className="feedback-list">
        {filteredFeedbacks.length === 0 ? (
          <p className="empty-state">No feedback found</p>
        ) : (
          filteredFeedbacks.map((fb) => <FeedbackCard key={fb.id} feedback={fb} />)
        )}
      </div>
    </DashboardLayout>
  );
}
