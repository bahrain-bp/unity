import Sidebar from "../../components/Sidebar";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
  header: string;
  children: ReactNode;
  className: string;
}

function DashboardLayout({ header, children, className }: DashboardLayoutProps) {
  return (
    <div className="dashboard">
      <Sidebar />

      <div className="dashboard__header">
        <h3>{header}</h3>
      </div>

      <div className={`dashboard__container${className ? " " + className : ""}`}>{children}</div>
    </div>
  );
}

export default DashboardLayout;
