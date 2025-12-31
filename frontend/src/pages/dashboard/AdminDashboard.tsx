import TotalBahtwinVisitors from "../../components/dashboard/TotalBahtwinVisitors";
import RecentVisitors from "../../components/dashboard/RecentVisitors";
import AvgFeedbackScore from "../../components/dashboard/AvgFeedbackScore";
import VisitorComments from "../../components/dashboard/VisitorComments";
import ActiveUsers from "../../components/dashboard/ActiveUsers";
import InvitationsToday from "../../components/dashboard/InvitationsToday";
import UsersLast6HoursChart from "../../components/dashboard/UsersLast6HoursChart";
import UsersToday from "../../components/dashboard/UsersToday";
import DashboardLayout from "./DashboardLayout";

const Dashboard = () => {
  return (
    <DashboardLayout header="Admin Dashboard" className="dashboard_IoT">
      {/* Top 4 KPI cards */}
      <div className="box box1 orange-theme">
        <AvgFeedbackScore />
      </div>
      <div className="box box2 orange-theme">
        <TotalBahtwinVisitors />
      </div>
      <div className="box box3 orange-theme">
        <ActiveUsers />
      </div>
      <div className="box box4 orange-theme">
        <InvitationsToday />
      </div>

      {/* Full width chart */}
      <div className="box box5 orange-theme">
        <UsersLast6HoursChart />
      </div>

      {/* Bottom row */}
      <div className="bottom-row">
        <div className="box box7 orange-theme">
          <UsersToday />
        </div>
        <div className="box box8 orange-theme comments-theme">
          <RecentVisitors />
        </div>
        <div className="box box9 orange-theme comments-theme">
          <VisitorComments />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
