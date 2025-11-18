import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import "../styles/globals.css";
import Landing from "./pages/Landing";
import Info from "./pages/Info";

function App() {
  return (
    <>
      <Router>
      {/* <img src={bg} className="bg" /> */}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/info" element={<Info />} />
        </Routes>
      </Router>


      <footer></footer>
    </>
  );
}

export default App;
