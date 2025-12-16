import React, { useState, useEffect } from "react";
import "../../sass/_feedback.scss";
import { useNavigate } from "react-router-dom";
import { FeedbackClient } from "../services/api";

const Feedback = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [systemRating, setSystemRating] = useState(null);
  const [faster, setFaster] = useState("");
  const [digitalPref, setDigitalPref] = useState("");
  const [faceHelp, setFaceHelp] = useState(null);
  const [overallRating, setOverallRating] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [showError, setShowError] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [visitorValid, setVisitorValid] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Extract token from URL
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      navigate("/error?message=invalid-link");
      return;
    }
    setToken(t);

    // Validate visitor
    const fetchVisitor = async () => {
      try {
        const response = await FeedbackClient.get(
          "/getVisitorInfo",
          { headers: { Authorization: `Bearer ${t}` } }
        );
        setName(response.data.name);
        setEmail(response.data.email);
        setVisitorValid(true);
      } catch (err) {
  console.error(err);

  if (err.response) {
    const { status, data } = err.response;

    if (status === 401) {
      navigate("/error", { state: { message: "Visitor not allowed" } });
    } else if (status === 403) {
      if (data && data.error === "Token already used") {
        navigate("/error", { state: { message: "Feedback already submitted" } });
      } else {
        navigate("/error", { state: { message: "Link invalid" } });
      }
    } else {
      navigate("/error", { state: { message: "Server error" } });
    }
  } else {
    navigate("/error", { state: { message: "Server error" } });
  }
} finally {
  setLoading(false);
}
    };

    fetchVisitor();
  }, [navigate]);

  if (loading) return <div>Validating your link...</div>;
  if (!visitorValid) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!systemRating || !faster || !digitalPref || !faceHelp || !overallRating) {
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
      return;
    }

    const payload = {
      name,
      email,
      purpose,
      checkInTime,
      systemRating,
      faster,
      digitalPref,
      faceHelp,
      overallRating,
      commentText,
    };

    try {
      await FeedbackClient.post(
        "/submitFeedback",
        payload,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      navigate("/thank-you"); // Redirect to thank-you page
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 403) {
        navigate("/error?message=link-expired");
      } else {
        navigate("/error?message=server-error");
      }
    }
  };

  return (
    <div className="feedback-page">
      <div className="container">
        <h2>Leave Your Feedback</h2>

        <form onSubmit={handleSubmit}>
          {/* Name and Email */}
          <input type="text" value={name} readOnly />
          <input type="email" value={email} readOnly />

          {/* Purpose */}
          <div className="form-group">
            <label>Purpose of your visit:</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">Select...</option>
              <option value="meeting">Meeting a Host</option>
              <option value="interview">Interview</option>
              <option value="training">Training</option>
              <option value="maintenance">Maintenance / Contractor</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Check-in Time */}
          <div className="form-group">
            <label>How long did check-in take?</label>
            <select value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)}>
              <option value="">Select...</option>
              <option value="less1">Less than 1 minute</option>
              <option value="1to2">1–2 minutes</option>
              <option value="3to5">3–5 minutes</option>
              <option value="more5">More than 5 minutes</option>
            </select>
          </div>

          {/* System Rating */}
          <div className="form-group">
            <label>Rate your experience with the digital system:</label>
            <div className="radio-group">
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num}>
                  <input type="radio" value={num} checked={systemRating === num} onChange={() => setSystemRating(num)} /> {num}
                </label>
              ))}
            </div>
          </div>

          {/* Faster */}
          <div className="form-group">
            <label>Did the system make your visit faster?</label>
            <div className="radio-group">
              {["yes", "somewhat", "no"].map((val) => (
                <label key={val}>
                  <input type="radio" value={val} checked={faster === val} onChange={() => setFaster(val)} /> {val.charAt(0).toUpperCase() + val.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Digital Preference */}
          <div className="form-group">
            <label>Do you prefer digital check-in?</label>
            <select value={digitalPref} onChange={(e) => setDigitalPref(e.target.value)}>
              <option value="">Select...</option>
              <option value="prefer_digital">Yes, digital is better</option>
              <option value="prefer_manual">No, manual is better</option>
              <option value="no_preference">No preference</option>
            </select>
          </div>

          {/* Face Help */}
          <div className="form-group">
            <label>How helpful was the face recognition system?</label>
            <div className="radio-group">
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num}>
                  <input type="radio" value={num} checked={faceHelp === num} onChange={() => setFaceHelp(num)} /> {num}
                </label>
              ))}
            </div>
          </div>

          {/* Overall Satisfaction */}
          <div className="form-group">
            <label>Overall satisfaction:</label>
            <div className="radio-group">
              {[1, 2, 3, 4, 5].map((num) => (
                <label key={num}>
                  <input type="radio" value={num} checked={overallRating === num} onChange={() => setOverallRating(num)} /> {num}
                </label>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="form-group">
            <label>Add a Comment:</label>
            <textarea placeholder="What can we improve?" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          </div>

          <button type="submit">Submit</button>
          {showError && <div className="error">Please complete all required fields!</div>}
        </form>
      </div>
    </div>
  );
};

export default Feedback;
