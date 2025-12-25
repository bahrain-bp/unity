import "../../../sass/AdminDashboard.scss";
import TotalBahtwinVisitors from "../../components/TotalBahtwinVisitors";
import SimulatedLight from "../../components/RecentVisitors";
import AvgFeedbackScore from "../../components/AvgFeedbackScore";
import VisitorComments from "../../components/VisitorComments";
import ActiveUsers  from "../../components/ActiveUsers";
import InvitationsToday  from "../../components/InvitationsToday";
import UsersLast6HoursChart from "../../components/UsersLast6HoursChart";

const Dashboard = () => {
  return (
    <div className="dashboard">
      {/* Top 4 boxes */}
      <div className="box box1 orange-theme"><AvgFeedbackScore /></div>
      <div className="box box2 orange-theme"><TotalBahtwinVisitors /></div>
      <div className="box box3 orange-theme"><ActiveUsers/></div>
      <div className="box box4 orange-theme"><InvitationsToday /></div>

      {/* Middle 2 graphs */}
      <div className="box box5 orange-theme"><UsersLast6HoursChart /></div>
      <div className="box box6 orange-theme">Graph 2</div>

      {/* Bottom 3 boxes inside bottom-row container */}
      <div className="bottom-row">
        <div className="box box7 orange-theme">Box 7</div>
        <div className="box box8 orange-theme comments-theme"><SimulatedLight /></div>
        <div className="box box9 orange-theme comments-theme"><VisitorComments /></div>
      </div>
    </div>
  )
}

export default Dashboard;
