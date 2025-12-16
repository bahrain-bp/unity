import { useState, useEffect } from "react";
import "../../sass/_feedback.scss";
import { useNavigate } from "react-router-dom";
import { FeedbackClient } from "../services/api";

const Feedback = () => {
  // Visitor info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Feedback fields
  const [purpose, setPurpose] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [faster, setFaster] = useState("");
  const [digitalPref, setDigitalPref] = useState("");
  const [faceHelp, setFaceHelp] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [commentText, setCommentText] = useState("");

  // State handling
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [visitorValid, setVisitorValid] = useState(false);
  const [showError, setShowError] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");

    if (!t) {
      navigate("/error", { state: { message: "invalid-link" } });
      return;
    }

    setToken(t);

    const fetchVisitor = async () => {
      try {
        const res = await FeedbackClient.get("/getVisitorInfo", {
          headers: { Authorization: `Bearer ${t}` },
        });
        setName(res.data.name);
        setEmail(res.data.email);
        setVisitorValid(true);
      } catch (err) {
  console.error(err);

  // Pass the server error message directly if available
  const serverMessage = err.response?.data?.error || "Server error occurred";
  navigate("/error", { state: { message: serverMessage } });
}
    };

    fetchVisitor();
  }, [navigate]);

  if (loading) return <div className="feedback-loading">Validating your link…</div>;
  if (!visitorValid) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    const requiredFields = [
      purpose,
      checkInTime,
      faster,
      digitalPref,
      faceHelp,
      overallRating,
    ];

    const hasEmpty = requiredFields.some((field) => !field || field === 0);

    if (hasEmpty) {
      setShowError(true);
      setTimeout(() => setShowError(false), 4000);
      return;
    }

    const payload = {
      name,
      email,
      purpose,
      checkInTime,
      faster,
      digitalPref,
      faceHelp,
      overallRating,
      commentText,
    };

    try {
      await FeedbackClient.post("/submitFeedback", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      navigate("/thank-you");
    } catch (err) {
      console.error(err);

      // Handle server response messages
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
        } else if (status >= 400 && status < 500) {
          navigate("/error", { state: { message: data?.error || "Invalid request" } });
        } else {
          navigate("/error", { state: { message: "Server error" } });
        }
      } else {
        navigate("/error", { state: { message: "Server error" } });
      }
    }
  };

  const StarRating = ({ value, setValue }) => (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= value ? "active" : ""}
          onClick={() => setValue(star)}
        >
          ★
        </span>
      ))}
    </div>
  );

  return (
    <div className="feedback-page">
      <div className="auth">
        <h2>Visitor Feedback</h2>
        <p className="subtitle">
          Your feedback helps us improve the BAHTWIN experience.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="row">
            <input type="text" value={name} readOnly />
            <input type="email" value={email} readOnly />
          </div>

          <div className="form-group">
            <label>Purpose of visit</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">Select</option>
              <option value="meeting">Meeting</option>
              <option value="interview">Interview</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Check-in duration</label>
            <select value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)}>
              <option value="">Select</option>
              <option value="less1">Less than 1 minute</option>
              <option value="1to2">1–2 minutes</option>
              <option value="3to5">3–5 minutes</option>
              <option value="more5">More than 5 minutes</option>
            </select>
          </div>

          <div className="form-group">
            <label>Which registration method do you prefer?</label>
            <select value={digitalPref} onChange={(e) => setDigitalPref(e.target.value)}>
              <option value="">Select</option>
              <option value="face-recognition">Pre-registration via face recognition</option>
              <option value="manual-reception">Manual registration at reception</option>
            </select>
          </div>

          <div className="form-group">
            <label>Did BAHTWIN make your visit faster or smoother?</label>
            <div className="pill-group">
              {["yes", "somewhat", "no"].map((v) => (
                <button
                  type="button"
                  key={v}
                  className={faster === v ? "active" : ""}
                  onClick={() => setFaster(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Face recognition usefulness</label>
            <StarRating value={faceHelp} setValue={setFaceHelp} />
          </div>

          <div className="form-group">
            <label>Overall satisfaction</label>
            <StarRating value={overallRating} setValue={setOverallRating} />
          </div>

          <div className="form-group">
            <label>Additional comments</label>
            <textarea
              placeholder="Tell us how we can improve…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </div>

          {showError && (
            <div className="error">Please complete all required fields</div>
          )}

          <button type="submit" className="auth__button">
            Submit Feedback
          </button>
        </form>
      </div>
    </div>
  );
};

export default Feedback;
