'use client'

// import { usePathname } from "next/navigation";
import {OVERVIEW, USERS, USER } from "../assets/icons";
import logo from "../assets/logo.svg";
import {Link, useLocation} from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="sidebar">
      <Link to={"/"} className="sidebar__logo">
        <img src={logo} alt="logo" />
        <p>BAHTWIN</p>
      </Link>
      <div className="sidebar__menu">
        <Link to={"/dashboard"} className={pathname === "/dashboard" ? "active" : ""}>
          {OVERVIEW()} <span>Overview</span>
        </Link>
        <Link to={"/dashboard/users"} className={pathname === "/dashboard/users" ? "active" : ""}>
          {USERS()} <span>Users</span>
        </Link>
        <Link to={"/dashboard/InviteVisitor"} className={pathname === "/dashboard/invite-visitor" ? "active" : ""}>
          {USER()} <span>Invite Visitor</span>
        </Link>
      </div>
      <div className="sidebar__bottom">
        <Link to={"/account"} className={pathname === "/account" ? "active" : ""}>
          {USER()}
          <span>Account</span>
        </Link>
      </div>
    </div>
  );
}
