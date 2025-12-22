import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
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

function App() {
  return (
    <>
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
                <IoT />
              </>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <>
                <Users />
              </>
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
          <Route
            path="/dashboard/InviteVisitor"
            element={
              <>
                <InviteVisitor />
              </>
            }
          />
          <Route
            path="/VisitorFeedBack"
            element={
              <>
                <VisitorFeedBack />
              </>
            }
          />
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
        </Routes>
      </Router>
      <Chatbot />
      <Footer />
    </>
  );
}

export default App;
