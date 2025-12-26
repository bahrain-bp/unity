import React from "react";
import { useLocation } from "react-router-dom";

const ErrorPage = () => {
  const location = useLocation();

  // Read message from state (if passed via navigate)
  const message = location.state?.message;

  let displayText = "Something went wrong.";

  if (message === "invalid-link") displayText = "This link is invalid.";
  else if (message === "link-expired") displayText = "This link has expired.";
  else if (message === "server-error") displayText = "Unable to connect to the server.";
  else if (message === "Visitor not allowed") displayText = "You are not allowed to access this feedback.";
  else if (message === "Feedback already submitted") displayText = "You have already submitted feedback.";

  return (
    <div className="error-page">

      <p>{displayText}</p>
    </div>
  );
};

export default ErrorPage;
