import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import "../styles/globals.css";
import Landing from "./pages/Landing";
import Info from "./pages/Info";
import Navbar from "./components/Navbar";

function App() {
  return (
    <>
      <Router>
      {/* <img src={bg} className="bg" /> */}
        <Routes>
          <Route path="/" element={<><Navbar /><Landing /></>} />
          <Route path="/info" element={<><Navbar /><Info /></>} />
        </Routes>
      </Router>


      <footer></footer>
    </>
  );
}

export default App;
