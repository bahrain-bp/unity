import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "../styles/globals.css";
import Landing from "./pages/Landing";
import Info from "./pages/Info";
import Navbar from "./components/Navbar";
import Authentication from "./pages/Authentication";
import Environment from "./pages/Environment";
import Chatbot from "./components/ChatBot";
import Dashboard from "./pages/Dashboard";
import VisitorArrival from "./pages/visitorArrival";
import InviteVisitor from "./pages/InviteVisitor";
import VisitorFeedBack from "./pages/VisitorFeedback";
import ErrorPage from "./pages/error";
import ThankYouPage from "./pages/thank-you";
import AdminDashboard from "./pages/AdminDashboard";
import { WebSocketProvider } from "./context/WebSocketContext"; // import your provider

function App() {
  const year = new Date().getFullYear();

  return (
    <WebSocketProvider>
      <Router>
        <Routes>
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
          <Route
            path="/auth"
            element={
              <>
                <Navbar />
                <Authentication />
              </>
            }
          />
          <Route
            path="/environment"
            element={
              <>
                <Navbar />
                <Environment />
              </>
            }
          />
          <Route
            path="/dashboard"
            element={
              <>
                <Navbar />
                <Dashboard />
              </>
            }
          />
          <Route
            path="/visitor-arrival"
            element={<VisitorArrival />}
          />
          <Route
            path="/InviteVisitor"
            element={<InviteVisitor />}
          />
          <Route
            path="/VisitorFeedBack"
            element={<VisitorFeedBack />}
          />
          <Route
            path="/error"
            element={<ErrorPage />}
          />
          <Route
            path="/thank-you"
            element={<ThankYouPage />}
          />
          <Route
            path="/AdminDashboard"
            element={<AdminDashboard />}
          />
        </Routes>
      </Router>

      <Chatbot />

      <footer className="footer">
        <div className="footer__container">
          &copy;{year} Bahrain Amazon Web Services. All Rights Reserved
        </div>
      </footer>
    </WebSocketProvider>
  );
}

export default App;
