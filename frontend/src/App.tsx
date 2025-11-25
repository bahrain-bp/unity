import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "../styles/globals.css";
import Landing from "./pages/Landing";
import Info from "./pages/Info";
import Navbar from "./components/Navbar";
import Authentication from "./pages/Authentication";

function App() {
  const year = new Date().getFullYear();

  return (
    <>
      <Router>
        {/* <img src={bg} className="bg" /> */}
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
        </Routes>
      </Router>

      <footer className="footer">
        <div className="footer__container">&copy;{year} Bahrain Amazon Web Services. All Rights Reserved</div>
      </footer>
    </>
  );
}

export default App;
