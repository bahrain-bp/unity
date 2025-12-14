// src/pages/ThankYouPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const ThankYouPage = () => {
  const navigate = useNavigate();

  return (
    <div className="thank-you-container">
      <h1>Thank You!</h1>
      <p>Your feedback has been submitted successfully. We appreciate your time and input.</p>

      <button onClick={() => navigate("/")}>Return to Home</button>
    </div>
  );
};

export default ThankYouPage;
