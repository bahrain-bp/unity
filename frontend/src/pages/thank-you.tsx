// src/pages/ThankYouPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "../../sass/_feedback.scss"; // Use same styling

const ThankYouPage = () => {
  const navigate = useNavigate();

  return (
    <div className="feedback1-page">
      <div className="auth">
        <h2>Thank You!</h2>
        <p className="subtitle">
          We’ve received your feedback. Your input helps us make the BAHTWIN experience even better.
        </p>

        <p style={{ textAlign: "center", marginTop: "1rem", color: "#555" }}>
          Have a great day and thank you for taking the time to share your thoughts!
        </p>

        <button
          className="auth__button"
          style={{ display: "block", margin: "2rem auto 0" }}
          onClick={() => navigate("/")}
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default ThankYouPage;
