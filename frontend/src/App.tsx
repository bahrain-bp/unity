import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import "../styles/globals.css";
import Landing from "./pages/Landing";
import Info from "./pages/Info";
import Navbar from "./components/Navbar";
import Authentication from "./pages/Authentication";
import Environment from "./pages/Environment";
import Chatbot from "./components/ChatBot";
import VisitorArrival from "./pages/visitorArrival";
import InviteVisitor from "./pages/dashboard/InviteVisitor";
import VisitorFeedBack from "./pages/VisitorFeedback";
import ErrorPage from "./pages/error";
import ThankYouPage from "./pages/thank-you";
import Users from "./pages/dashboard/Users";
import IoT from "./pages/dashboard/IoT";
import Footer from "./components/Footer";
import { useAuth } from "./auth/AuthHook";
import UploadUnity from "./pages/dashboard/UploadUnity";
import { useEffect } from "react";

// Protected Route Component for authenticated users
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

// Admin Only Route Component
function AdminRoute({ children }) {
  const { userRole } = useAuth();

  if (userRole !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Public Only Route (redirects authenticated users)
function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { userId } = useAuth();

  useEffect(() => {
    let lastHeartbeatSentAt = 0;
    const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

    const maybeSendHeartbeat = () => {
      const now = Date.now();

      if (now - lastHeartbeatSentAt < HEARTBEAT_INTERVAL) {
        return;
      }

      lastHeartbeatSentAt = now;

      fetch(`${import.meta.env.VITE_API_URL}heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId, // replace later with Cognito userId
          timestamp: now,
        }),
      }).catch(() => {
        // silently ignore network errors
      });
    };

    //idk if this is correct but i think it works, that's what matters now

    window.addEventListener("click", maybeSendHeartbeat);
    window.addEventListener("scroll", maybeSendHeartbeat);
    window.addEventListener("keydown", maybeSendHeartbeat);

    return () => {
      window.removeEventListener("click", maybeSendHeartbeat);
      window.removeEventListener("scroll", maybeSendHeartbeat);
      window.removeEventListener("keydown", maybeSendHeartbeat);
    };
  }, []);
  return (
    <>
      <Router>
        <Routes>
          {/* Public routes - accessible to everyone */}
          <Route
            path="/"
            element={
              <>
                <Navbar />
                <Landing />
              </>
            }
          />
          <Route
            path="/info"
            element={
              <>
                <Navbar />
                <Info />
              </>
            }
          />

          {/* Auth route - only for non-authenticated users */}
          <Route
            path="/auth"
            element={
              <PublicOnlyRoute>
                <Navbar />
                <Authentication />
              </PublicOnlyRoute>
            }
          />

          {/* Protected routes - for authenticated users only */}
          <Route
            path="/environment"
            element={
              <ProtectedRoute>
                <Navbar />
                <Environment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <IoT />
              </AdminRoute>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
          <Route
            path="/dashboard/upload-unity"
            element={
              <AdminRoute>
                <UploadUnity />
              </AdminRoute>
            }
          />
          <Route
            path="/InviteVisitor"
            element={
              <AdminRoute>
                <InviteVisitor />
              </AdminRoute>
            }
          />
          <Route
            path="/visitor-arrival"
            element={
              <>
                <VisitorArrival />
              </>
            }
          />

          {/* Visitor routes - public access */}
          <Route
            path="/VisitorFeedBack"
            element={
              <>
                <VisitorFeedBack />
              </>
            }
          />

          {/* Utility routes */}
          <Route
            path="/error"
            element={
              <>
                <ErrorPage />
              </>
            }
          />
          <Route
            path="/thank-you"
            element={
              <>
                <ThankYouPage />
              </>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Chatbot />
      <Footer />
    </>
  );
}

export default App;
