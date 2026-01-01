import { useEffect, useRef, useState } from "react"
import DashboardLayout from "./DashboardLayout"
import Client from "../../services/api"
import { Chart } from "chart.js/auto"

const getDashboardAnalytics = async () => {
  const res = await Client.get("/analytics/dashboard")
  return res.data
}

type ApiChart = {
  id: string
  title: string
  kind: "bar" | "line" | "pie"
  labels: string[]
  series: { name: string; data: number[] }[]
  meta?: { horizontal?: boolean; rule?: string }
}

const ChartCard = ({ chart }: { chart: ApiChart }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    chartInstance.current?.destroy()

    const ORANGE_DARK = "#ff7614"


    chartInstance.current = new Chart(canvasRef.current, {
      type: chart.kind,
      data: {
        labels: chart.labels,
        datasets: chart.series.map(s => {
          if (chart.kind === "pie") {
            return {
              label: s.name,
              data: s.data,
              backgroundColor: [ORANGE_DARK, "rgba(200,200,200,0.6)"],
              borderWidth: 1,
            }
          }

          return {
            label: s.name,
            data: s.data,
            tension: chart.kind === "line" ? 0.35 : 0,
            borderColor: ORANGE_DARK,
            backgroundColor: chart.kind === "line" ? "rgba(255, 118, 20, 0.10)" : "rgba(255, 118, 20, 0.25)",
            borderWidth: chart.kind === "line" ? 2 : 1,
            pointBackgroundColor: ORANGE_DARK,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: chart.meta?.horizontal ? "y" : "x",
        plugins: {
          legend: {
            labels: {
              boxWidth: 12,
              color: "#555",
            },
          },
        },
        scales:
          chart.kind === "pie"
            ? {}
            : {
                x: { grid: { display: false }, ticks: { color: "#555" } },
                y: { beginAtZero: true, grid: { color: "#eee" }, ticks: { color: "#555" } },
              },
      },
    })
    return () => chartInstance.current?.destroy()
  }, [chart])

  return (
    <div className="overview__card">
      <h4>{chart.title}</h4>
      {chart.meta?.rule && <p className="overview__note">{chart.meta.rule}</p>}
      <div className="overview__canvas">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

const Analytics = () => {
  const [charts, setCharts] = useState<ApiChart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await getDashboardAnalytics()
        setCharts(data.charts)
      } catch (e: any) {
        setError(e.message || "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <DashboardLayout className="dashboard__overview" header="Overview">
      {error && <div className="dashboard__error">{error}</div>}

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          Loading analytics…
        </div>
      ) : (
        <div className="overview__grid">
          {charts.map(chart => (
            <ChartCard key={chart.id} chart={chart} />
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}

export default Analytics

