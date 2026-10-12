import { FC, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ChartData,
  ChartOptions,
  Plugin,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { ProcessedFrame, Signal } from '../types/aldl'

ChartJS.register(LinearScale, TimeScale, PointElement, LineElement, Tooltip)

/** How much of the history the chart shows, in milliseconds. */
const WINDOW_MS = 60_000

/** Colour of the vertical lines drawn at event markers. */
const MARKER_COLOR = 'rgba(128, 128, 128, 0.7)'

/** Draws a thin vertical line at the timestamp of each noted frame. */
const markerPlugin: Plugin<'line'> = {
  id: 'eventMarkers',
  afterDatasetsDraw(chart, _args, options) {
    const times = (options as { times?: number[] }).times ?? []
    const { ctx, chartArea, scales } = chart
    ctx.save()
    ctx.strokeStyle = MARKER_COLOR
    ctx.lineWidth = 1
    for (const time of times) {
      const x = scales.x.getPixelForValue(time)
      if (x < chartArea.left || x > chartArea.right) continue
      ctx.beginPath()
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.stroke()
    }
    ctx.restore()
  },
}

/** One plotted sample: normalised for the axis, raw for the tooltip. */
interface ChartPoint {
  x: number
  y: number
  originalValue: number
  unit: string
}

interface PIDChartProps {
  /** The ordered PID list; only those with min/max can be plotted. */
  rows: Signal[]
  history: ProcessedFrame[]
  latest: ProcessedFrame | null
  visiblePids: ReadonlySet<string>
  onTogglePid: (pidName: string) => void
}

const COLORS = [
  '#FF6B6B', // darker pastel red
  '#4ECDC4', // darker pastel green
  '#45B7D1', // darker pastel blue
  '#FFD93D', // darker pastel yellow
  '#FF85A1', // darker pastel pink
  '#6BCB77', // darker pastel mint
  '#4D96FF', // darker pastel sky blue
  '#FF9F45', // darker pastel orange
  '#9B72CF', // darker pastel purple
  '#4ECB71', // darker pastel turquoise
  '#FF6B8B', // darker pastel rose
  '#95CD41', // darker pastel lime
  '#6B66FF', // darker pastel indigo
  '#FF9F6B', // darker pastel peach
  '#4ECB9E', // darker pastel seafoam
]

const PIDChart: FC<PIDChartProps> = ({
  rows,
  history,
  latest,
  visiblePids,
  onTogglePid,
}) => {
  const plottable = useMemo(
    () =>
      rows
        .filter(
          (signal) =>
            typeof signal.min === 'number' && typeof signal.max === 'number',
        )
        .map((signal, index) => ({
          name: signal.name,
          unit: signal.unit,
          min: signal.min ?? 0,
          max: signal.max ?? 1,
          color: COLORS[index % COLORS.length],
        })),
    [rows],
  )

  const windowStart = latest ? latest.timestamp - WINDOW_MS : 0
  const windowEnd = latest ? latest.timestamp : 0

  /** Only the last WINDOW_MS of frames ever reach Chart.js. */
  const recent = useMemo(
    () =>
      latest === null
        ? []
        : history.filter((frame) => frame.timestamp >= windowStart),
    [history, latest, windowStart],
  )

  const chartData = useMemo<ChartData<'line', ChartPoint[]>>(() => {
    const datasets = plottable
      .filter((pid) => visiblePids.has(pid.name))
      .map((pid) => {
        const span = pid.max - pid.min || 1
        const data: ChartPoint[] = []
        for (const frame of recent) {
          const signal = frame.signals.find((s) => s.name === pid.name)
          if (!signal) continue
          data.push({
            x: frame.timestamp,
            y: ((signal.value - pid.min) / span) * 100,
            originalValue: signal.value,
            unit: pid.unit,
          })
        }
        return {
          label: pid.name,
          data,
          borderColor: pid.color,
          backgroundColor: pid.color,
          tension: 0.1,
        }
      })
    return { datasets }
  }, [plottable, recent, visiblePids])

  const noteTimes = useMemo(
    () => recent.filter((frame) => frame.note).map((frame) => frame.timestamp),
    [recent],
  )

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'second',
            displayFormats: { second: 'HH:mm:ss' },
          },
          ticks: { display: true, maxRotation: 0, stepSize: 10 },
          // Newest at the left, so the chart reads like the table.
          reverse: true,
          min: latest ? windowStart : undefined,
          max: latest ? windowEnd : undefined,
        },
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: false },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        eventMarkers: { times: noteTimes },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw as ChartPoint
              return `${context.dataset.label ?? ''}: ${point.originalValue.toFixed(1)}${point.unit}`
            },
          },
        },
      },
    }),
    [latest, windowStart, windowEnd, noteTimes],
  )

  return (
    <div className="pid-chart-container">
      <div className="pid-toggle-buttons">
        {plottable.map((pid) => {
          const active = visiblePids.has(pid.name)
          return (
            <button
              type="button"
              key={pid.name}
              className={active ? 'active' : ''}
              onClick={() => onTogglePid(pid.name)}
              style={{
                borderColor: pid.color,
                borderWidth: '2px',
                borderStyle: 'solid',
                backgroundColor: active ? pid.color : 'transparent',
                color: active ? 'white' : pid.color,
              }}
            >
              {pid.name}
            </button>
          )
        })}
      </div>
      <div className="chart-container">
        <Line data={chartData} options={options} plugins={[markerPlugin]} />
      </div>
    </div>
  )
}

export default PIDChart
