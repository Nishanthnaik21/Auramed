import React, { useState } from 'react';
import { ShieldCheck, User, Phone, KeyRound, ArrowRight, Sun, Moon, AlertCircle, Sparkles } from 'lucide-react';
import { DEMO_PATIENTS, DemoPatient } from '../data/demoPatients';

interface LoginPageProps {
  onLogin: (patient: DemoPatient) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, theme, onToggleTheme }) => {
  const [patientIdInput, setPatientIdInput] = useState('mp001');
  const [mobileInput, setMobileInput] = useState('9876543210');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDark = theme === 'dark';

  const handleSelectDemo = (id: 'mp001' | 'mp002') => {
    const demo = DEMO_PATIENTS[id];
    setPatientIdInput(demo.patientId);
    setMobileInput(demo.mobile);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const cleanId = patientIdInput.trim().toLowerCase();
      const cleanMobile = mobileInput.trim().replace(/\D/g, '');

      // Check match by ID or Mobile or Name
      let matchedPatient: DemoPatient | undefined;

      if (cleanId === 'mp001' || cleanMobile === '9876543210' || cleanId.includes('dhyan')) {
        matchedPatient = DEMO_PATIENTS.mp001;
      } else if (cleanId === 'mp002' || cleanMobile === '9876543211' || cleanId.includes('anish')) {
        matchedPatient = DEMO_PATIENTS.mp002;
      } else if (DEMO_PATIENTS[cleanId]) {
        matchedPatient = DEMO_PATIENTS[cleanId];
      }

      if (matchedPatient) {
        onLogin(matchedPatient);
      } else {
        setErrorMessage(
          'Invalid credentials. Please use demo Patient ID "mp001" (Dhyan Anchan) or "mp002" (Anish).'
        );
      }
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 transition-colors duration-200 ${
        isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Top Bar */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white font-black shadow-md shadow-sky-500/20 text-lg">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              AuraMed
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clinical Access & Pharmacometrics Reasoning Portal
            </p>
          </div>
        </div>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-xs'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>White Theme</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-sky-600" />
              <span>Dark Theme</span>
            </>
          )}
        </button>
      </div>

      {/* Main Login Card Container */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div
          className={`rounded-2xl p-6 sm:p-8 border shadow-lg transition-all duration-200 ${
            isDark
              ? 'bg-[#111827]/90 border-slate-800 shadow-2xl backdrop-blur-md'
              : 'bg-white border-slate-200/90 shadow-xl shadow-slate-200/50'
          }`}
        >
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-mono mb-3">
              <Sparkles className="w-3 h-3" />
              <span>EHR Prototype • Standalone Demo Mode</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Patient Portal Login
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Authenticate using your assigned Patient ID and registered mobile number
            </p>
          </div>

          {/* Quick-Select Demo Accounts */}
          <div className="mb-6 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quick Demo Accounts (1-Click Fill)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectDemo('mp001')}
                className={`text-left p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                  patientIdInput.toLowerCase() === 'mp001'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-400/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Dhyan Anchan</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                    mp001
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  📞 9876543210
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectDemo('mp002')}
                className={`text-left p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                  patientIdInput.toLowerCase() === 'mp002'
                    ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-400/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Anish</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    mp002
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-1">
                  📞 9876543211
                </div>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Patient ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={patientIdInput}
                  onChange={(e) => setPatientIdInput(e.target.value)}
                  placeholder="e.g. mp001 or mp002"
                  required
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition font-mono ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 shadow-xs'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition font-mono ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600/20 shadow-xs'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              <span>Authenticate & Access Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Card Footer Security Note */}
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted via Deterministic Salted HMAC-SHA256</span>
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <div className="max-w-5xl mx-auto w-full pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div>AuraMed • Manipal Hackathon 2026 (Track 3)</div>
        <div className="font-mono text-[11px]">
          Demo Patients: Dhyan Anchan (mp001) • Anish (mp002)
        </div>
      </div>
    </div>
  );
};
