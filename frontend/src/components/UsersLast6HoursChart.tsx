import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Label,
} from "recharts";
import { Users } from "lucide-react";
import "../../sass/DashboardCards.scss";

interface UserHourData {
  hour: string;
  count: number;
}

interface UsersLast6HoursData {
  series: UserHourData[];
}

interface LoadDashboardResponse {
  card: string;
  data: UsersLast6HoursData;
}

export default function UsersLast6Hours() {
  const [seriesData, setSeriesData] = useState<UserHourData[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  const fetchUsersData = async () => {
    try {
      const response = await fetch("/admin/loadUsersLast6Hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component: "users_last_6_hours" }),
      });

      const data: LoadDashboardResponse = await response.json();

      if (data.card === "users_last_6_hours" && data.data.series) {
        setSeriesData(data.data.series);
      }
    } catch (err) {
      console.error("Error fetching users last 6 hours:", err);
    }
  };

  useEffect(() => {
    fetchUsersData();

    const ws = new WebSocket(
      "wss://wk3629navk.execute-api.us-east-1.amazonaws.com/dev/"
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const data: LoadDashboardResponse = JSON.parse(event.data);
        if (data.card === "users_last_6_hours" && data.data.series) {
          setSeriesData(data.data.series);
        }
      } catch (err) {
        console.error("WebSocket parse error:", err);
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = (err) => console.error("WebSocket error:", err);

    return () => ws.close();
  }, []);

  return (
    <div
      className="dashboard-card users-graph-theme"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <div className="card-header">
        <div className="card-icon">
          <Users size={30} color="#ff7614" />
        </div>
        <div className="card-title">
          Users in Last 6 Hours
          <span className={`status-dot ${connected ? "online" : "offline"}`} />
        </div>
      </div>

      {/* Chart fills remaining space */}
      <div style={{ flexGrow: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={seriesData}
            margin={{ top: 20, right: 20, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => value.split(" ")[1]} // only hour
            >
              <Label
                value="Hour"
                position="insideBottom"
                offset={-5}
                style={{ fontWeight: "bold" }}
              />
            </XAxis>
            <YAxis allowDecimals={false}>
              <Label
                value="Users"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: "middle", fontWeight: "bold" }}
              />
            </YAxis>
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#ff7614"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
