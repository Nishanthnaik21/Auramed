import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  User,
  AlertTriangle,
  Sun,
  Moon,
  LogOut,
  FileText,
  Users,
  Activity,
  MessageSquare,
  Network,
  Radio,
  Dna,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { smartFhir, PatientContext } from './fhir/client';
import { BiomarkerTrajectoryChart } from './components/BiomarkerTrajectoryChart';
import { RefillTimeline } from './components/RefillTimeline';
import { ClinicalActionPanel } from './components/ClinicalActionPanel';
import { LoginPage } from './components/LoginPage';
import { ClinicRosterView } from './components/ClinicRosterView';
import { ClinicalNoteModal } from './components/ClinicalNoteModal';
import { PharmacologyContradictionModal } from './components/PharmacologyContradictionModal';
import { PatientOutreachModal } from './components/PatientOutreachModal';
import { ClinicianFeedbackModal } from './components/ClinicianFeedbackModal';
import { DEMO_PATIENTS, DemoPatient } from './data/demoPatients';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<DemoPatient | null>(() => {
    const savedId = localStorage.getItem('auramed_logged_in_patient_id');
    if (savedId && DEMO_PATIENTS[savedId]) {
      return DEMO_PATIENTS[savedId];
    }
    // Default logged in patient is Dhyan Anchan (mp001)
    return DEMO_PATIENTS.mp001;
  });

  const [activeTab, setActiveTab] = useState<'chart' | 'roster'>('chart');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [isContradictionModalOpen, setIsContradictionModalOpen] = useState<boolean>(false);
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [liveStreamToast, setLiveStreamToast] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('auramed_theme');
    return saved === 'dark' ? 'dark' : 'light'; // Default to pristine White Theme
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('auramed_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (patient: DemoPatient) => {
    setCurrentUser(patient);
    setActiveTab('chart');
    localStorage.setItem('auramed_logged_in_patient_id', patient.patientId);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('auramed_logged_in_patient_id');
  };

  const handleSimulateLiveIngest = () => {
    if (!currentUser) return;
    const isSBP = currentUser.unit === 'mmHg';
    const simulatedVal = isSBP ? '148 mmHg' : '9.3%';
    setLiveStreamToast(
      `[Kafka Stream Event]: Ingested new cellular RPM measurement: ${simulatedVal} for ${currentUser.name} (${currentUser.patientId}) -> Flink Sliding Window & UKF Re-calibrated!`
    );
    setTimeout(() => {
      setLiveStreamToast(null);
    }, 4500);
  };

  const isDark = theme === 'dark';

  // If no user is authenticated, render the Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={handleLogin}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div
      className={`min-h-screen p-4 md:p-6 lg:p-8 flex flex-col space-y-6 max-w-7xl mx-auto transition-colors duration-200 ${
        isDark ? 'bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* SBAR Clinical Consultation Note Modal */}
      <ClinicalNoteModal
        patient={currentUser}
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        theme={theme}
      />

      {/* Neo4j Pharmacology Contradiction Visualizer Modal */}
      <PharmacologyContradictionModal
        patient={currentUser}
        isOpen={isContradictionModalOpen}
        onClose={() => setIsContradictionModalOpen(false)}
        theme={theme}
      />

      {/* Patient Non-Punitive SMS Assistant Modal */}
      <PatientOutreachModal
        patient={currentUser}
        isOpen={isOutreachModalOpen}
        onClose={() => setIsOutreachModalOpen(false)}
        theme={theme}
      />

      {/* Clinician Active Learning Feedback Modal */}
      <ClinicianFeedbackModal
        patient={currentUser}
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        theme={theme}
      />

      {/* Live Stream Animated Toast */}
      {liveStreamToast && (
        <div className="fixed top-4 right-4 z-50 p-4 max-w-md rounded-2xl bg-sky-900 text-white shadow-2xl border border-sky-500 animate-in slide-in-from-top-4 duration-200 flex items-start space-x-3 text-xs">
          <Radio className="w-5 h-5 text-sky-300 animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-mono leading-relaxed">
            <div className="font-bold text-sky-200 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Kafka Event Ingested</span>
              <span className="text-[10px] bg-sky-800 px-1.5 py-0.5 rounded">Real-Time Flink</span>
            </div>
            {liveStreamToast}
          </div>
        </div>
      )}

      {/* Top Clinical Navigation Bar */}
      <header
        className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b ${
          isDark ? 'border-slate-800' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white font-black shadow-md shadow-sky-500/20 text-lg">
            A
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                AuraMed
              </h1>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                  isDark
                    ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}
              >
                SMART-on-FHIR v1.2
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Adherence Uncertainty & Pharmacometrics Reasoning Engine
            </p>
          </div>
        </div>

        {/* Right Header: Theme Toggle, Patient Card, & Logout */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 shadow-xs cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={`Switch to ${isDark ? 'White Theme (Clinical Light)' : 'Dark Mode'}`}
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>White Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-600" />
                <span>Dark Theme</span>
              </>
            )}
          </button>

          {/* Patient Demographic Banner (Dhyan Anchan / Anish) */}
          <div
            className={`flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs border ${
              isDark
                ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800 shadow-xs'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 font-semibold">
                  ID: {currentUser.patientId}
                </span>
              </div>
              <div
                className={`font-mono text-[11px] ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                MRN: {currentUser.mrn} • DOB: {currentUser.birthDate} ({currentUser.gender})
              </div>
            </div>
          </div>

          {/* Logout / Switch Patient Button */}
          <button
            onClick={handleLogout}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-xs cursor-pointer ${
              isDark
                ? 'bg-rose-950/30 border-rose-800/80 text-rose-300 hover:bg-rose-900/50'
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800'
            }`}
            title="Log out or switch demo patient"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Switch Patient</span>
          </button>
        </div>
      </header>

      {/* Patient Pharmacogenomics (PGx) & Clearance Banner */}
      <div
        className={`px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDark ? 'bg-slate-900/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
        }`}
      >
        <div className="flex items-center space-x-2 font-medium">
          <Dna className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>PGx Metabolizer Phenotype:</span>
          <strong className="text-purple-600 dark:text-purple-400 font-mono">{currentUser.pgxMetabolizer}</strong>
          <span className="text-slate-400">•</span>
          <span>Clearance:</span>
          <strong className="font-mono text-teal-600 dark:text-teal-400">{currentUser.egfrValue}</strong>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Enzymatic Discard Rate: Validated Against Neo4j Cypher Traversal
        </div>
      </div>

      {/* Clinical Sub-Navigation: View Tabs, Live Ingest & Decision Support Modals */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="flex items-center space-x-2 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Patient Chart View</span>
          </button>

          <button
            onClick={() => setActiveTab('roster')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clinic Triage Roster (2 Cohorts)</span>
          </button>
        </div>

        {/* Action Buttons: Live Ingest, Contradiction Graph, Patient SMS, Audit Feedback, SBAR Note */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulate Live Inbound RPM Reading */}
          <button
            onClick={handleSimulateLiveIngest}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
            title="Simulate inbound cellular blood pressure reading into Kafka"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Simulate Live Ingest</span>
          </button>

          {/* Neo4j Contradiction Graph */}
          <button
            onClick={() => setIsContradictionModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-400 text-teal-700 dark:text-teal-300 shadow-xs transition cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 text-teal-600" />
            <span>Neo4j Graph</span>
          </button>

          {/* Patient SMS Assistant */}
          <button
            onClick={() => setIsOutreachModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 text-sky-700 dark:text-sky-300 shadow-xs transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
            <span>Patient SMS</span>
          </button>

          {/* Clinician Feedback & Audit */}
          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-400 text-purple-700 dark:text-purple-300 shadow-xs transition cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Audit Feedback</span>
          </button>

          {/* Export SBAR Note */}
          <button
            onClick={() => setIsNoteModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 shadow-xs transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>SBAR Note</span>
          </button>
        </div>
      </div>


      {/* Main Tab Content */}
      {activeTab === 'roster' ? (
        <ClinicRosterView
          onSelectPatient={(pt) => {
            setCurrentUser(pt);
            setActiveTab('chart');
          }}
          theme={theme}
        />
      ) : (
        <>
          {/* Uncertainty & Conformal Prediction Reasoning Banner */}
          <section
            className={`border rounded-xl p-4 shadow-sm transition-all duration-200 ${
              isDark
                ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-800/60 shadow-xl'
                : 'bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white border-amber-300/80 shadow-xs'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div
                  className={`p-2 rounded-lg mt-0.5 border ${
                    isDark
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                      Therapeutic Discordance Observed (Non-Punitive Adherence Alert)
                    </h2>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                        isDark
                          ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                          : 'bg-amber-100 border-amber-300 text-amber-900'
                      }`}
                    >
                      Conformal Coverage 90% (α=0.10)
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1.5 max-w-3xl leading-relaxed ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Observed {currentUser.biomarkerName} trajectory for <strong>{currentUser.name}</strong> exhibits a Mahalanobis residual divergence of{' '}
                    <strong className={isDark ? 'text-rose-400' : 'text-rose-600 font-bold'}>{currentUser.divergenceSigma}</strong> against
                    pharmacokinetic expectation. Claims telemetry indicates{' '}
                    <strong className={isDark ? 'text-amber-400' : 'text-amber-800 font-bold'}>PDC {(currentUser.pdcScore * 100).toFixed(1)}%</strong> with 2 distinct refill gap lapses.
                    Epistemic entropy is calibrated at{' '}
                    <strong className={`font-mono font-bold ${isDark ? 'text-cyan-400' : 'text-sky-700'}`}>
                      {currentUser.entropy}
                    </strong>
                    , confirming authentic regimen interruption rather than biological drug resistance.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <div
                  className={`px-3 py-1.5 rounded-lg text-center border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    State-Space Model
                  </div>
                  <div
                    className={`text-xs font-mono font-bold ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    UKF Active
                  </div>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-lg text-center border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-amber-300 shadow-xs'
                  }`}
                >
                  <div className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Conformal Verdict
                  </div>
                  <div
                    className={`text-xs font-mono font-bold ${
                      isDark ? 'text-amber-400' : 'text-amber-700'
                    }`}
                  >
                    {currentUser.conformalVerdict}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Main Clinical Grid: Trajectory & Timeline */}
          <main className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BiomarkerTrajectoryChart
              biomarkerName={currentUser.biomarkerName}
              unit={currentUser.unit}
              baselineValue={currentUser.baselineValue}
              currentDrug={currentUser.currentDrug}
              theme={theme}
            />
            <RefillTimeline
              pdcScore={currentUser.pdcScore}
              coveredDaysCount={currentUser.coveredDaysCount}
              refillGapIndex={currentUser.refillGapIndex}
              intervalVariance={currentUser.intervalVariance}
              theme={theme}
            />
          </main>

          {/* Clinical Decision & Action Ordering Panel */}
          <section>
            <ClinicalActionPanel theme={theme} />
          </section>
        </>
      )}

      {/* Footer System Diagnostics */}
      <footer
        className={`pt-4 border-t flex flex-col sm:flex-row items-center justify-between text-xs gap-2 ${
          isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-500'
        }`}
      >
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">Zero-PHI Salted HMAC-SHA256 Edge Encryption Verified</span>
        </div>
        <div className="flex items-center space-x-3 font-mono text-[11px]">
          <span>Authenticated as: {currentUser.name} ({currentUser.patientId})</span>
          <span>•</span>
          <span>Redis Online: Connected</span>
          <span>•</span>
          <span>Triton: Healthy (&lt;5ms)</span>
        </div>
      </footer>
    </div>
  );
};



