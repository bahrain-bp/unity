import { useLocation, useNavigate } from "react-router-dom";

const ErrorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Show exactly what the server returned
  const serverMessage = location.state?.message;

  return (
    <div className="feedback1-page">
      <div className="auth">
        <h2>Error</h2>
        <p className="subtitle">{serverMessage || "Oops! Something went wrong."}</p>

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

export default ErrorPage;
