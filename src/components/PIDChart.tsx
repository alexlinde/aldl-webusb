import { FC, useState, useEffect } from 'react'
import { ProcessedFrame } from '../types/aldl'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
)

interface PIDChartProps {
  frame: ProcessedFrame
}

interface ChartPoint {
  timestamp: number
  value: number
  normalizedValue: number
}

interface PIDData {
  [pidName: string]: ChartPoint[]
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
  '#4ECB9E'  // darker pastel seafoam
]

const PIDChart: FC<PIDChartProps> = ({ frame }) => {
  const [pidData, setPidData] = useState<PIDData>({})
  const [visiblePids, setVisiblePids] = useState<Set<string>>(new Set())
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  })
  const [timeRange, setTimeRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 })

  // Get PIDs that can be plotted (have min/max values) and assign colors
  const plottablePids = frame.signals
    .filter(signal => 
      typeof signal.min === 'number' &&
      typeof signal.max === 'number'
    )
    .map((signal, index) => ({
      signal,
      color: COLORS[index % COLORS.length]
    }))

  useEffect(() => {
    // Update PID data when new signals arrive
    const newPidData = { ...pidData }

    // Skip adding data if timestamp is null (initial frame)
    if (frame.timestamp !== null) {
      plottablePids.forEach(({ signal }) => {
        if (!newPidData[signal.name]) {
          newPidData[signal.name] = []
        }
        newPidData[signal.name].push({
          timestamp: frame.timestamp!,
          value: signal.value,
          normalizedValue: (signal.value - signal.min!) / (signal.max! - signal.min!) * 100
        })
      })

      setPidData(newPidData)
    }
  }, [frame])

  useEffect(() => {
    // Update chart data when PID data changes
    const datasets = Array.from(visiblePids).map(pidName => {
      const data = pidData[pidName] || []
      const { signal, color } = plottablePids.find(p => p.signal.name === pidName)!
      return {
        label: pidName,
        data: data.map(point => ({
          x: point.timestamp,
          y: point.normalizedValue,
          originalValue: point.value,
          unit: signal.unit || ''
        })),
        borderColor: color,
        backgroundColor: color,
        tension: 0.1
      }
    })

    // Calculate time range
    const allTimestamps = Object.values(pidData).flatMap(data => 
      data.map(point => point.timestamp)
    )
    if (allTimestamps.length > 0) {
      const maxTimestamp = Math.max(...allTimestamps)
      const newTimeRange = {
        min: maxTimestamp - 60000, // 60 seconds ago
        max: maxTimestamp
      }
      setTimeRange(newTimeRange)
    }

    setChartData({
      labels: Array.from(new Set(allTimestamps)),
      datasets
    })
  }, [pidData, visiblePids])

  const handleTogglePid = (pidName: string) => {
    setVisiblePids(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pidName)) {
        newSet.delete(pidName)
      } else {
        newSet.add(pidName)
      }
      return newSet
    })
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'second',
          displayFormats: {
            second: 'HH:mm:ss'
          }
        },
        ticks: {
          display: true,
          maxRotation: 0,
          stepSize: 10 // Show label every 10 seconds
        },
        reverse: true,
        min: timeRange.min,
        max: timeRange.max
      },
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: false
        },
        ticks: {
          display: false
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dataset = context.dataset
            const point = dataset.data[context.dataIndex] as any
            return `${dataset.label}: ${point.originalValue.toFixed(1)}${point.unit}`
          }
        }
      }
    }
  }

  return (
    <div className="pid-chart-container">
      <div className="pid-toggle-buttons">
        {plottablePids.map(({ signal, color }) => (
          <button
            key={signal.name}
            className={visiblePids.has(signal.name) ? 'active' : ''}
            onClick={() => handleTogglePid(signal.name)}
            style={{
              borderColor: color,
              borderWidth: '2px',
              borderStyle: 'solid',
              backgroundColor: visiblePids.has(signal.name) ? color : 'transparent',
              color: visiblePids.has(signal.name) ? 'white' : color
            }}
          >
            {signal.name}
          </button>
        ))}
      </div>
      <div className="chart-container" style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}

export default PIDChart 