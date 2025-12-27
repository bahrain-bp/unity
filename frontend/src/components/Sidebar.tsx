"use client";

// import { usePathname } from "next/navigation";
import { OVERVIEW, USERS, USER, ED } from "../assets/icons";
import logo from "../assets/logo.svg";
import { Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;

  const dashboard_pages = [
    {
      name: "Overview",
      route: "/dashboard",
      icon: OVERVIEW,
    },
    {
      name: "Users",
      route: "/dashboard/users",
      icon: USERS,
    },
    {
      name: "WebGL Files",
      route: "/dashboard/upload-unity",
      icon: ED,
    },
    {
      name: "Visitor Arrival",
      route: "/visitor-arrival",
      icon: USER,
    },
    {
      name: "Parking",
      route: "/dashboard/parking",
      icon: USERS, // leave it as USERS for now
    },
  ];

  return (
    <div className="sidebar">
      <Link to={"/"} className="sidebar__logo">
        <img src={logo} alt="logo" />
        <p>BAHTWIN</p>
      </Link>
      <div className="sidebar__menu">
        {dashboard_pages.map((page) => {
          return (
            <Link
              to={page.route}
              className={pathname === page.route ? "active" : ""}
            >
              {page.icon()} <span>{page.name}</span>
            </Link>
          );
        })}
      </div>
      <div className="sidebar__bottom">
        <Link
          to={"/account"}
          className={pathname === "/account" ? "active" : ""}
        >
          {USER()}
          <span>Account</span>
        </Link>
      </div>
    </div>
  );
}
