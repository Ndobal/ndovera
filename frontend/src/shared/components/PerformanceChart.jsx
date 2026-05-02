import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function PerformanceChart() {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8
        }
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    },
    elements: {
      line: {
        tension: 0.4
      }
    }
  };

  const data = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [
      {
        label: 'Average Score (%)',
        data: [75, 82, 78, 85, 89, 92],
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'Class Average (%)',
        data: [70, 72, 75, 74, 78, 80],
        borderColor: '#64748b', // slate-500
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
      }
    ],
  };

  return (
    <div className="bg-white glass-surface p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="micro-label text-slate-500 neon-subtle mb-1">Analytics</p>
          <h2 className="text-lg command-title text-slate-800 neon-title">Performance Trend</h2>
        </div>
        <select className="text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-600 bg-white/70 dark:bg-slate-800/40 dark:text-cyan-100 dark:border-cyan-300/25 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option>This Term</option>
          <option>Last Term</option>
          <option>Full Year</option>
        </select>
      </div>
      <div className="relative flex-grow min-h-[250px]">
        <Line options={options} data={data} />
      </div>
    </div>
  );
}
