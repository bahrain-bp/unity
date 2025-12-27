import "../../../sass/AdminDashboard.scss";
import TotalBahtwinVisitors from "../../components/TotalBahtwinVisitors";
import RecentVisitors from "../../components/RecentVisitors";
import AvgFeedbackScore from "../../components/AvgFeedbackScore";
import VisitorComments from "../../components/VisitorComments";
import ActiveUsers from "../../components/ActiveUsers";
import InvitationsToday from "../../components/InvitationsToday";
import UsersLast6HoursChart from "../../components/UsersLast6HoursChart";
import UsersToday from "../../components/UsersToday";

const Dashboard = () => {
  return (
    <div className="dashboard">
      {/* Top 4 KPI cards */}
      <div className="box box1 orange-theme"><AvgFeedbackScore /></div>
      <div className="box box2 orange-theme"><TotalBahtwinVisitors /></div>
      <div className="box box3 orange-theme"><ActiveUsers /></div>
      <div className="box box4 orange-theme"><InvitationsToday /></div>

      {/* Full width chart */}
      <div className="box box5 orange-theme"><UsersLast6HoursChart /></div>

      {/* Bottom row */}
      <div className="bottom-row"> 
        <div className="box box7 orange-theme"><UsersToday/></div> 
        <div className="box box8 orange-theme comments-theme"><RecentVisitors /></div>
        <div className="box box9 orange-theme comments-theme"><VisitorComments /></div>
      </div>
    </div>
  );
};

export default Dashboard;
