import React from 'react';
import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface DispenseEvent {
  day: number;
  dateStr: string;
  medication: string;
  ndc: string;
  daysSupply: number;
  pharmacy: string;
}

interface RefillTimelineProps {
  pdcScore?: number;
  coveredDaysCount?: number;
  refillGapIndex?: number;
  intervalVariance?: number;
  theme?: 'light' | 'dark';
}

export const RefillTimeline: React.FC<RefillTimelineProps> = ({
  pdcScore = 0.522,
  coveredDaysCount = 47,
  refillGapIndex = 0.478,
  intervalVariance = 14.2,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  // Dispense events over 90-day observation window
  const dispenses: DispenseEvent[] = [
    { day: 0, dateStr: 'Jan 02', medication: 'Lisinopril 20mg', ndc: '00002-3228-30', daysSupply: 30, pharmacy: 'Walgreens #1042' },
    { day: 45, dateStr: 'Feb 16', medication: 'Lisinopril 20mg', ndc: '00002-3228-30', daysSupply: 17, pharmacy: 'CVS Pharmacy #882' },
  ];

  // Generate 90 discrete days
  // Day 0..29 covered (fill 1)
  // Day 30..44 GAP (15 days unmedicated)
  // Day 45..61 covered (fill 2, 17 days supply)
  // Day 62..89 GAP (28 days unmedicated)
  const days = Array.from({ length: 90 }, (_, i) => {
    const isCoveredFill1 = i >= 0 && i < 30;
    const isCoveredFill2 = i >= 45 && i < 62;
    const isCovered = isCoveredFill1 || isCoveredFill2;

    const isPickup = dispenses.some((d) => d.day === i);
    const dispense = dispenses.find((d) => d.day === i);

    return {
      dayIndex: i,
      isCovered,
      isPickup,
      dispense,
    };
  });

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
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-amber-50 border border-amber-200 text-amber-600 shadow-xs'
            }`}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Claims Dispensing & Refill Gap Timeline
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              90-Day Observational Window • Day-Level Proportion of Days Covered (PDC)
            </p>
          </div>
        </div>

        {/* Metrics Pill Grid */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-lg text-center border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              90-Day PDC
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                pdcScore < 0.8
                  ? isDark
                    ? 'text-amber-400'
                    : 'text-amber-600'
                  : isDark
                  ? 'text-emerald-400'
                  : 'text-emerald-600'
              }`}
            >
              {(pdcScore * 100).toFixed(1)}%
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg text-center border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Covered Days
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                isDark ? 'text-cyan-400' : 'text-sky-700'
              }`}
            >
              {coveredDaysCount}/90
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg text-center border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Refill Gap Index
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                isDark ? 'text-rose-400' : 'text-rose-600'
              }`}
            >
              {refillGapIndex.toFixed(2)}
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg text-center border hidden md:block ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Interval Variance
            </div>
            <div
              className={`text-sm font-bold font-mono ${
                isDark ? 'text-purple-400' : 'text-purple-700'
              }`}
            >
              {intervalVariance.toFixed(1)}d²
            </div>
          </div>
        </div>
      </div>

      {/* 90-Day Visual Grid */}
      <div className="space-y-2">
        <div
          className={`flex items-center justify-between text-xs font-mono mb-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <span>Day 0 (Start)</span>
          <span>Day 30</span>
          <span>Day 60</span>
          <span>Day 89 (Today)</span>
        </div>

        {/* Grid of 90 Day Blocks */}
        <div
          className={`grid grid-cols-15 sm:grid-cols-30 gap-1 p-2.5 rounded-lg border ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {days.map((d) => (
            <div
              key={d.dayIndex}
              title={`Day ${d.dayIndex}: ${d.isCovered ? 'Covered' : 'Unmedicated Gap'}${
                d.isPickup ? ` • Picked up ${d.dispense?.medication}` : ''
              }`}
              className={`h-6 rounded-sm transition-all duration-150 flex items-center justify-center relative group cursor-pointer ${
                d.isPickup
                  ? isDark
                    ? 'bg-cyan-400 ring-2 ring-cyan-300 shadow-md shadow-cyan-500/50 z-10'
                    : 'bg-blue-600 ring-2 ring-blue-300 shadow-md shadow-blue-500/30 z-10'
                  : d.isCovered
                  ? isDark
                    ? 'bg-cyan-600/60 hover:bg-cyan-500'
                    : 'bg-sky-500 hover:bg-sky-600'
                  : isDark
                  ? 'bg-rose-950/40 border border-rose-900/50 hover:bg-rose-900/60'
                  : 'bg-rose-50 border border-rose-200/80 hover:bg-rose-100'
              }`}
            >
              {d.isPickup && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 pt-2 text-xs ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <div
                className={`w-3 h-3 rounded-sm ${
                  isDark ? 'bg-cyan-600/60' : 'bg-sky-500'
                }`}
              ></div>
              <span>Medication Covered</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div
                className={`w-3 h-3 rounded-sm ring-1 ring-white ${
                  isDark ? 'bg-cyan-400' : 'bg-blue-600'
                }`}
              ></div>
              <span>Pharmacy Fill / Pickup</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div
                className={`w-3 h-3 rounded-sm border ${
                  isDark ? 'bg-rose-950/60 border-rose-900/80' : 'bg-rose-50 border-rose-200'
                }`}
              ></div>
              <span>Refill Lapse / Gap</span>
            </div>
          </div>
          <div
            className={`text-xs font-semibold flex items-center ${
              isDark ? 'text-amber-400' : 'text-amber-700'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            2 distinct unmedicated gap intervals identified (15d, 28d)
          </div>
        </div>
      </div>

      {/* Pharmacy Claims Detail Feed */}
      <div
        className={`mt-4 pt-3 border-t ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        <h4
          className={`text-xs font-bold uppercase tracking-wider mb-2 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          Claims & Dispense History
        </h4>
        <div className="space-y-2">
          {dispenses.map((d, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition border ${
                isDark
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-200'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-[11px] border ${
                    isDark
                      ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                      : 'bg-sky-50 border-sky-200 text-sky-700'
                  }`}
                >
                  #{idx + 1}
                </div>
                <div>
                  <div className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {d.medication}
                  </div>
                  <div
                    className={`text-[11px] font-mono ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    NDC: {d.ndc} • {d.pharmacy}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-mono font-semibold ${
                    isDark ? 'text-cyan-400' : 'text-sky-700'
                  }`}
                >
                  {d.daysSupply} Days Supply
                </div>
                <div
                  className={`text-[11px] flex items-center justify-end ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {d.dateStr} (Day {d.day})
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

