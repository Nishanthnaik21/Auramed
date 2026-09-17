import React from 'react';
import { Users, AlertTriangle, ArrowUpRight, TrendingUp, ShieldCheck, Activity, Pill } from 'lucide-react';
import { DEMO_PATIENTS, DemoPatient } from '../data/demoPatients';

interface ClinicRosterViewProps {
  onSelectPatient: (patient: DemoPatient) => void;
  theme: 'light' | 'dark';
}

export const ClinicRosterView: React.FC<ClinicRosterViewProps> = ({
  onSelectPatient,
  theme,
}) => {
  const isDark = theme === 'dark';
  const patientsList = Object.values(DEMO_PATIENTS);

  return (
    <div className="space-y-6">
      {/* Roster Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark
              ? 'bg-[#111827]/90 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Cohort Monitored</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black">{patientsList.length} Patients</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            • 100% Real-time Stream Synced
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark
              ? 'bg-[#111827]/90 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Therapeutic Discordance</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">2 Active</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Confirmed Adherence Lapses
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark
              ? 'bg-[#111827]/90 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Mean 90-Day PDC</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-rose-600">50.4%</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">
            Sub-Therapeutic (&lt;80% CMS Part D)
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border transition-all ${
            isDark
              ? 'bg-[#111827]/90 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Safety Gate Coverage</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">91.86%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Exceeds 90% FDA Standard (α=0.10)
          </div>
        </div>
      </div>

      {/* Cohort Triage Table */}
      <div
        className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${
          isDark
            ? 'bg-[#111827]/90 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`p-4 px-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          <div>
            <h3 className="text-base font-bold">Outpatient Pharmacometrics Triage Roster</h3>
            <p className="text-xs text-slate-500">
              Ranked by Mahalanobis residual divergence r(t) comparing observed biomarkers against PK/PD predictions
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-sky-600 dark:text-sky-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>UKF Continuous Engine Active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead
              className={`border-b font-mono uppercase tracking-wider text-[10px] ${
                isDark
                  ? 'border-slate-800 bg-slate-900/60 text-slate-400'
                  : 'border-slate-200 bg-slate-100/60 text-slate-500'
              }`}
            >
              <tr>
                <th className="py-3.5 px-6">Patient & MRN</th>
                <th className="py-3.5 px-6">Regimen & Target</th>
                <th className="py-3.5 px-6">90-Day PDC</th>
                <th className="py-3.5 px-6">Residual Divergence (r)</th>
                <th className="py-3.5 px-6">Conformal Verdict</th>
                <th className="py-3.5 px-6">Clinical Triage</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {patientsList.map((pt) => {
                const pdcPercent = pt.pdcScore * 100;
                return (
                  <tr
                    key={pt.patientId}
                    className={`transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-slate-850/60' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => onSelectPatient(pt)}
                  >
                    {/* Patient Name */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {pt.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {pt.mrn} • {pt.birthDate} ({pt.gender})
                      </div>
                    </td>

                    {/* Regimen */}
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                        <Pill className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">{pt.currentDrug}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {pt.biomarkerName}
                      </div>
                    </td>

                    {/* PDC Score */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono font-bold text-xs ${
                            pdcPercent < 80 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {pdcPercent.toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pdcPercent < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pdcPercent}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {pt.coveredDaysCount}/90 Days Covered
                      </div>
                    </td>

                    {/* Divergence */}
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded text-xs">
                        {pt.divergenceSigma}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Entropy: {pt.entropy}
                      </div>
                    </td>

                    {/* Conformal Verdict */}
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                        {pt.conformalVerdict}
                      </span>
                    </td>

                    {/* Risk Level */}
                    <td className="py-4 px-6">
                      <div className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Unmedicated Rebound</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Do not escalate dose
                      </div>
                    </td>

                    {/* Open Chart */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPatient(pt);
                        }}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition"
                      >
                        <span>Open Chart</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
