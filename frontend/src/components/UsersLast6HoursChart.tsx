import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// TypeScript interfaces for API response
interface HourData {
  hour: number;
  users: number;
}

interface UsersResponse {
  date: string;
  timezone: string;
  hours: HourData[];
  generatedAt: number;
}

const UsersLast6HoursChart: React.FC = () => {
  const [chartData, setChartData] = useState({
    labels: [] as string[],
    datasets: [] as {
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor: string;
      borderWidth: number;
    }[],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          "https://twrmzrk7v3.execute-api.us-east-1.amazonaws.com/dev/users-today-hourly"
        );
        const data: UsersResponse = await res.json();
        console.log(data)

        // Get the last 6 hours
        const last6Hours = data.hours.slice(-6);
        const labels = last6Hours.map((item) => `${item.hour}:00`);
        const users = last6Hours.map((item) => item.users);

        setChartData({
          labels,
          datasets: [
            {
              label: "Users",
              data: users,
              backgroundColor: "rgba(75, 192, 192, 0.6)",
              borderColor: "rgba(75, 192, 192, 1)",
              borderWidth: 1,
            },
          ],
        });
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h2>Users in the Last 6 Hours</h2>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { display: true, position: "top" },
            title: { display: true, text: "Users Last 6 Hours" },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "Number of Users" },
            },
            x: {
              title: { display: true, text: "Hour" },
            },
          },
        }}
      />
    </div>
  );
};

export default UsersLast6HoursChart;
