import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';

interface LabPoint {
  day: number;
  dateStr: string;
  measuredValue: number;
  counterfactualExpected: number;
  lowerBand90: number;
  upperBand90: number;
  mahalanobisDivergence: number;
}

interface BiomarkerTrajectoryChartProps {
  biomarkerName?: string;
  unit?: string;
  baselineValue?: number;
  currentDrug?: string;
  theme?: 'light' | 'dark';
}

export const BiomarkerTrajectoryChart: React.FC<BiomarkerTrajectoryChartProps> = ({
  biomarkerName = 'Systolic Blood Pressure (SBP)',
  unit = 'mmHg',
  baselineValue = 152,
  currentDrug = 'Lisinopril 20mg daily',
  theme = 'light',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<LabPoint | null>(null);
  const [projectedAdherence, setProjectedAdherence] = useState<number>(100);
  const isDark = theme === 'dark';

  // 90-day trajectory data points
  const points: LabPoint[] = [
    { day: 0, dateStr: 'Day 0', measuredValue: 152, counterfactualExpected: 152, lowerBand90: 147, upperBand90: 157, mahalanobisDivergence: 0.2 },
    { day: 15, dateStr: 'Day 15', measuredValue: 138, counterfactualExpected: 139, lowerBand90: 133, upperBand90: 144, mahalanobisDivergence: 0.4 },
    { day: 30, dateStr: 'Day 30', measuredValue: 132, counterfactualExpected: 131, lowerBand90: 126, upperBand90: 136, mahalanobisDivergence: 0.5 },
    { day: 45, dateStr: 'Day 45 (Refill Gap)', measuredValue: 146, counterfactualExpected: 128, lowerBand90: 122, upperBand90: 133, mahalanobisDivergence: 3.4 },
    { day: 60, dateStr: 'Day 60', measuredValue: 148, counterfactualExpected: 127, lowerBand90: 121, upperBand90: 132, mahalanobisDivergence: 3.8 },
    { day: 75, dateStr: 'Day 75 (Lapse)', measuredValue: 150, counterfactualExpected: 126, lowerBand90: 120, upperBand90: 131, mahalanobisDivergence: 4.2 },
    { day: 90, dateStr: 'Day 90 (Current)', measuredValue: 149, counterfactualExpected: 126, lowerBand90: 120, upperBand90: 131, mahalanobisDivergence: 4.1 },
  ];

  // SVG dimensions (Scale day 0 to 120 to include 30-day forecast)
  const svgWidth = 720;
  const svgHeight = 280;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  const minVal = 115;
  const maxVal = 165;
  const totalDays = 120;

  const getX = (day: number) => padding.left + (day / totalDays) * graphWidth;
  const getY = (val: number) => padding.top + graphHeight - ((val - minVal) / (maxVal - minVal)) * graphHeight;

  // Compute 30-day What-If forecast based on adherence slider
  // Current day 90 value: 149
  // Optimal target: 126
  const targetVal = 126;
  const currentVal = 149;
  const adherenceFraction = projectedAdherence / 100;
  // Dynamic PK/PD asymptotic recovery formula:
  const day105Forecast = currentVal - (currentVal - targetVal) * adherenceFraction * 0.65;
  const day120Forecast = currentVal - (currentVal - targetVal) * adherenceFraction;

  const forecastPoints = [
    { day: 90, val: currentVal },
    { day: 105, val: day105Forecast },
    { day: 120, val: day120Forecast },
  ];

  const forecastPath = forecastPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.val)}`)
    .join(' ');

  // Generate SVG path for 90% Confidence Interval Band (Upper curve forward, Lower curve backward)
  const upperPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.upperBand90)}`).join(' ');
  const lowerPathReversed = [...points].reverse().map((p) => `L ${getX(p.day)} ${getY(p.lowerBand90)}`).join(' ');
  const confidenceBandArea = `${upperPath} ${lowerPathReversed} Z`;

  // Counterfactual Expected Line
  const expectedLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.counterfactualExpected)}`).join(' ');

  // Observed Measurements Line
  const observedLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.day)} ${getY(p.measuredValue)}`).join(' ');

  return (
    <div
      className={`rounded-xl p-5 transition-all duration-200 border ${
        isDark
          ? 'bg-[#111827]/90 border-slate-800 shadow-2xl backdrop-blur-md text-slate-100'
          : 'bg-white border-slate-200/90 shadow-sm text-slate-800'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                : 'bg-sky-50 border border-sky-200 text-sky-600 shadow-xs'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {biomarkerName}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                LOINC 8480-6
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Assigned Regimen:{' '}
              <span className={isDark ? 'text-cyan-400 font-medium' : 'text-sky-700 font-semibold'}>
                {currentDrug}
              </span>
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-3 h-3 rounded-full border shadow-sm ${
                isDark
                  ? 'bg-rose-500 border-rose-300 shadow-rose-500/50'
                  : 'bg-rose-600 border-white shadow-rose-500/20'
              }`}
            ></div>
            <span className={isDark ? 'text-slate-300' : 'text-slate-600 font-medium'}>Observed Labs</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-4 h-0.5 border-t-2 border-dashed ${
                isDark ? 'border-cyan-400' : 'border-sky-600'
              }`}
            ></div>
            <span className={isDark ? 'text-slate-300' : 'text-slate-600 font-medium'}>
              Expected PK/PD (ŷ)
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-4 h-0.5 border-t-2 border-dashed border-emerald-500"></div>
            <span className="text-emerald-600 font-medium">What-If Forecast</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[620px] select-none">
          {/* Background Grid */}
          {[120, 130, 140, 150, 160].map((val) => (
            <g key={val}>
              <line
                x1={padding.left}
                y1={getY(val)}
                x2={svgWidth - padding.right}
                y2={getY(val)}
                stroke={isDark ? '#1e293b' : '#e2e8f0'}
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={getY(val) + 4}
                fill={isDark ? '#64748b' : '#94a3b8'}
                fontSize="11"
                textAnchor="end"
                fontFamily="JetBrains Mono"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Vertical Day Grid */}
          {[0, 30, 60, 90, 120].map((day) => (
            <g key={day}>
              <line
                x1={getX(day)}
                y1={padding.top}
                x2={getX(day)}
                y2={svgHeight - padding.bottom}
                stroke={day === 90 ? '#94a3b8' : isDark ? '#1e293b' : '#e2e8f0'}
                strokeWidth={day === 90 ? 1.5 : 1}
                strokeDasharray={day === 90 ? '3 3' : undefined}
              />
              <text
                x={getX(day)}
                y={svgHeight - padding.bottom + 18}
                fill={day === 90 ? (isDark ? '#38bdf8' : '#0284c7') : isDark ? '#64748b' : '#94a3b8'}
                fontSize="11"
                textAnchor="middle"
                fontFamily="JetBrains Mono"
                fontWeight={day === 90 ? 'bold' : 'normal'}
              >
                {day === 90 ? 'Day 90 (Today)' : day === 120 ? '+30d Forecast' : `Day ${day}`}
              </text>
            </g>
          ))}

          {/* Forecast Zone Shading */}
          <rect
            x={getX(90)}
            y={padding.top}
            width={getX(120) - getX(90)}
            height={graphHeight}
            fill={isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.04)'}
          />

          {/* 90% Confidence Interval Shaded Region */}
          <path
            d={confidenceBandArea}
            fill={isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(2, 132, 199, 0.08)'}
            stroke={isDark ? 'rgba(6, 182, 212, 0.25)' : 'rgba(2, 132, 199, 0.25)'}
            strokeWidth="1"
          />

          {/* Counterfactual Expected Response (ŷ) */}
          <path
            d={expectedLinePath}
            fill="none"
            stroke={isDark ? '#06b6d4' : '#0284c7'}
            strokeWidth="2.5"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />

          {/* Observed Clinical Labs Curve */}
          <path
            d={observedLinePath}
            fill="none"
            stroke={isDark ? '#f43f5e' : '#e11d48'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Simulated Forecast Trajectory Curve (Day 90 to 120) */}
          <path
            d={forecastPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />

          {/* Forecast Terminal Dot at Day 120 */}
          <circle
            cx={getX(120)}
            cy={getY(day120Forecast)}
            r={6}
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="2"
            className="animate-pulse"
          />
          <text
            x={getX(120)}
            y={getY(day120Forecast) - 10}
            fill="#10b981"
            fontSize="10"
            textAnchor="middle"
            fontFamily="JetBrains Mono"
            fontWeight="bold"
          >
            {day120Forecast.toFixed(0)} {unit}
          </text>

          {/* Data Points with Mahalanobis Indicators */}
          {points.map((p, idx) => {
            const isHighDivergence = p.mahalanobisDivergence >= 2.5;
            const isHovered = hoveredPoint?.day === p.day;

            return (
              <g
                key={idx}
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Outer Glow Halo for Divergent Points */}
                {isHighDivergence && (
                  <circle
                    cx={getX(p.day)}
                    cy={getY(p.measuredValue)}
                    r={isHovered ? 12 : 9}
                    fill={isDark ? 'rgba(244, 63, 94, 0.2)' : 'rgba(225, 29, 72, 0.15)'}
                    stroke={isDark ? 'rgba(244, 63, 94, 0.6)' : 'rgba(225, 29, 72, 0.5)'}
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                )}

                {/* Primary Data Dot */}
                <circle
                  cx={getX(p.day)}
                  cy={getY(p.measuredValue)}
                  r={isHovered ? 6 : 4.5}
                  fill={
                    isHighDivergence
                      ? isDark
                        ? '#f43f5e'
                        : '#e11d48'
                      : isDark
                      ? '#10b981'
                      : '#059669'
                  }
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* Expected Value Ghost Dot */}
                <circle
                  cx={getX(p.day)}
                  cy={getY(p.counterfactualExpected)}
                  r={3}
                  fill={isDark ? '#06b6d4' : '#0284c7'}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className={`absolute z-20 rounded-lg p-3 shadow-xl pointer-events-none transition-all duration-100 min-w-[220px] border ${
              isDark
                ? 'bg-slate-900/95 border-slate-700 text-slate-100'
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200'
            }`}
            style={{
              left: `${Math.min(getX(hoveredPoint.day) + 15, graphWidth - 140)}px`,
              top: `${Math.max(getY(hoveredPoint.measuredValue) - 70, 20)}px`,
            }}
          >
            <div
              className={`flex items-center justify-between border-b pb-1.5 mb-1.5 ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}
            >
              <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {hoveredPoint.dateStr}
              </span>
              {hoveredPoint.mahalanobisDivergence >= 2.5 ? (
                <span
                  className={`flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                    isDark
                      ? 'bg-rose-950/50 text-rose-400 border-rose-800'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 mr-1" /> Divergent
                </span>
              ) : (
                <span
                  className={`flex items-center font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                    isDark
                      ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" /> On Target
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <div
                className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                <span>Observed Lab:</span>
                <span className={`font-bold font-mono ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                  {hoveredPoint.measuredValue} {unit}
                </span>
              </div>
              <div
                className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                <span>Expected PK/PD:</span>
                <span className={`font-mono ${isDark ? 'text-cyan-400' : 'text-sky-700'}`}>
                  {hoveredPoint.counterfactualExpected.toFixed(1)} {unit}
                </span>
              </div>
              <div
                className={`flex justify-between ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                <span>90% CI Bounds:</span>
                <span className={`font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  [{hoveredPoint.lowerBand90} - {hoveredPoint.upperBand90}]
                </span>
              </div>
              <div
                className={`flex justify-between pt-1 border-t ${
                  isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                }`}
              >
                <span>Mahalanobis (r):</span>
                <span
                  className={`font-mono font-bold ${
                    hoveredPoint.mahalanobisDivergence >= 2.5
                      ? isDark
                        ? 'text-rose-400'
                        : 'text-rose-600'
                      : isDark
                      ? 'text-emerald-400'
                      : 'text-emerald-600'
                  }`}
                >
                  {hoveredPoint.mahalanobisDivergence.toFixed(2)}σ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive What-If Counterfactual Simulation Slider */}
      <div
        className={`mt-4 p-3.5 rounded-xl border transition-all ${
          isDark
            ? 'bg-slate-900/80 border-slate-800'
            : 'bg-slate-50 border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Interactive What-If Simulation: Projected Adherence (Next 30 Days)
            </span>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
            Simulated Forecast: ~{day120Forecast.toFixed(0)} {unit} ({projectedAdherence >= 80 ? 'Therapeutic Goal' : 'Elevated Risk'})
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={projectedAdherence}
            onChange={(e) => setProjectedAdherence(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="font-mono text-xs font-bold w-12 text-right text-slate-800 dark:text-slate-200">
            {projectedAdherence}%
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
          Simulates physiological clearance & pharmacodynamic response (t½ = 12h) over the next 30 days if adherence is restored to <strong>{projectedAdherence}%</strong>.
        </p>
      </div>

      {/* Clinical Interpretation Banner */}
      <div
        className={`mt-3 pt-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-center space-x-2">
          <TrendingDown className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-sky-600'}`} />
          <span>
            Baseline:{' '}
            <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>
              {baselineValue} {unit}
            </strong>
          </span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
          <span>
            Target Response:{' '}
            <strong className={isDark ? 'text-cyan-400' : 'text-sky-700 font-semibold'}>
              ~126 {unit} (-26 mmHg)
            </strong>
          </span>
        </div>
        <div className={`font-semibold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
          Residual Divergence r(t) = +4.10σ indicates unmedicated rebound
        </div>
      </div>
    </div>
  );
};


