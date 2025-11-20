import { Link } from "react-router-dom";

function Navbar() {
  return(
    <div className="navbar">
      <Link to={"/"} >Home</Link>
      <Link to={"/"} >Information</Link>
      <Link to={"/"} >3D Environment</Link>
    </div>
  )
}

export default Navbar;