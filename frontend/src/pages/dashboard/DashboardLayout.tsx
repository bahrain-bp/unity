import Sidebar from "../../components/Sidebar";
import type { ReactNode } from "react";
import { useState } from "react";
import { MENU } from "../../assets/icons";

interface DashboardLayoutProps {
  header: string;
  children: ReactNode;
  className: string;
}

function DashboardLayout({
  header,
  children,
  className,
}: DashboardLayoutProps) {
  const [open, setOpen] = useState(false);
  const toggleDrawer =
    (state: boolean) => (event?: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event?.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }
      setOpen(state);
    };
  return (
    <div className="dashboard">
      <Sidebar
        open={open}
        onOpen={toggleDrawer(true)}
        onClose={toggleDrawer(false)}
      />

      <div className="dashboard__header">
        <h3>{header}</h3>
        <span className="sidebar_trigger" onClick={toggleDrawer(true)}>
          {MENU()}
        </span>
      </div>

      <div
        className={`dashboard__container${className ? " " + className : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

export default DashboardLayout;
