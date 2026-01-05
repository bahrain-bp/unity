"use client";

// import { usePathname } from "next/navigation";
import {
  OVERVIEW,
  USERS,
  USER,
  ED,
  USERADD,
  STAR,
  ANALYTICS,
  PARKING,
  BOARD,
} from "../assets/icons";
import logo from "../assets/logo.svg";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthHook";
import { useEffect, useState } from "react";
import { ImageClient } from "../services/api";
import tmpUserImg from "../assets/user.png";

export default function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { email, userId } = useAuth();

  const [userImg, setUserImg] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const getUserImg = async () => {
    try {
      const result = await ImageClient.get(`/visitor/me?userId=${userId}`);

      if (result.status === 200) {
        setUserImg(result.data.imageUrl);
        setUsername(result.data.name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      getUserImg();
    }
  }, [userId]);

  const dashboard_pages = [
    {
      name: "Overview",
      route: "/dashboard",
      icon: OVERVIEW,
    },
    {
      name: "Analytics",
      route: "/dashboard/analytics",
      icon: ANALYTICS,
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
      name: "Feedback",
      route: "/dashboard/feedbacks",
      icon: STAR,
    },
    {
      name: "Visitor Arrival",
      route: "/visitor-arrival",
      icon: USER,
    },
    {
      name: "Invite Visitor",
      route: "/InviteVisitor",
      icon: USERADD,
    },
    {
      name: "Parking",
      route: "/dashboard/parking",
      icon: PARKING,
    },
    {
      name: "Whiteboard",
      route: "/dashboard/whiteboard",
      icon: BOARD,
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
        <a className={pathname === "/account" ? "active" : ""}>
          <img src={userImg ?? tmpUserImg} alt="profile picture" />

          <span>{username ? username : email.replace(/@.*/, "")}</span>
        </a>
      </div>
    </div>
  );
}