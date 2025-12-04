import { Link } from "react-router-dom";

function Navbar() {
  return(
    <div className="navbar">
      <Link to={"/"} >Home</Link>
      <Link to={"/info"} >Information</Link>
      <a href={"/auth"} >Register</a>
    </div>
  )
}

export default Navbar;