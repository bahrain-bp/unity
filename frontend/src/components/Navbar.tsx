import { Link } from "react-router-dom";

function Navbar() {
  return(
    <div className="navbar">
      <Link to={"/"} >Home</Link>
      <Link to={"/info"} >Information</Link>
      <Link to={"#"} >Register</Link>
    </div>
  )
}

export default Navbar;