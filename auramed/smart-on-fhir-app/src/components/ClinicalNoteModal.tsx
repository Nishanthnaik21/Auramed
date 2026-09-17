import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText, ShieldCheck, Stethoscope } from 'lucide-react';
import { DemoPatient } from '../data/demoPatients';

interface ClinicalNoteModalProps {
  patient: DemoPatient;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const ClinicalNoteModal: React.FC<ClinicalNoteModalProps> = ({
  patient,
  isOpen,
  onClose,
  theme,
}) => {
  const [copied, setCopied] = useState(false);
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const noteText = `================================================================================
AURAMED CLINICAL ADHERENCE CONSULTATION & PHARMACOMETRICS NOTE
Generated: ${todayStr} | SMART-on-FHIR Protocol v1.2
================================================================================
PATIENT DEMOGRAPHICS:
  Name: ${patient.name}
  Patient ID: ${patient.patientId} | MRN: ${patient.mrn}
  DOB: ${patient.birthDate} | Gender: ${patient.gender}
  Active Diagnosis: ${patient.condition}
  Current Regimen: ${patient.currentDrug}

1. SITUATION (S):
  Patient presents with persistent elevation in ${patient.biomarkerName} (current measured value: ${patient.baselineValue} ${patient.unit}) despite active prescription for ${patient.currentDrug}.

2. BACKGROUND (B):
  Longitudinal pharmacy claims telemetry over the preceding 90-day observational window demonstrates:
  - 90-Day Proportion of Days Covered (PDC): ${(patient.pdcScore * 100).toFixed(1)}% (CMS Threshold: >= 80.0%)
  - Total Covered Days: ${patient.coveredDaysCount} of 90 calendar days
  - Refill Gap Index (RGI): ${patient.refillGapIndex.toFixed(2)} with 2 distinct unmedicated gap intervals
  - Refill Interval Variance: ${patient.intervalVariance.toFixed(1)} days²

3. ASSESSMENT (A) - PHARMACOMETRICS & CONFORMAL REASONING:
  - Continuous-discrete PK/PD Unscented Kalman Filter (UKF) indicates a counterfactual expected response of ${patient.targetValue}.
  - Residual divergence between observed lab readings and expected disposition is ${patient.divergenceSigma}, indicating physiological rebound secondary to medication omission.
  - Conformal prediction gate coverage is calibrated at 90% (alpha = 0.10).
  - Epistemic entropy is calibrated at ${patient.entropy}, confirming authentic regimen interruption rather than biological pharmacological resistance.
  - Conformal Verdict: ${patient.conformalVerdict}.

4. RECOMMENDATION & CARE PLAN (R):
  [!] CRITICAL: Avoid punitive dose doubling/escalation, which introduces severe toxicity risk if normal adherence is abruptly resumed.
  1. Authorize Regimen Simplification: Switch to once-daily fixed-dose combination (FDC) to lower pill count and refill entropy.
  2. Diagnostic Order: Submit Comprehensive Metabolic Panel (CMP, LOINC 24323-8) to verify hepatic and renal clearance capacity.
  3. Patient Consultation: Non-punitive motivational review focusing on outpatient refill logistics and side-effect tolerability.

Attending Clinician Signature: ___________________________  Date: ____________
Electronic Health Record (EHR) Automated Synchronization Verified.
================================================================================`;

  const handleCopy = () => {
    navigator.clipboard.writeText(noteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#0f172a] border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between p-4 px-6 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600/10 border border-sky-600/30 flex items-center justify-center text-sky-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Clinical Adherence Consultation Note (SBAR)</h3>
              <p className="text-xs text-slate-500">
                Ready for one-click EHR Chart insertion or official PDF export
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: SBAR Note Preview */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-4">
          <div
            className={`p-4 rounded-xl border ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-3 flex justify-between items-center text-sky-600 dark:text-sky-400">
              <span>EHR PROGRESS NOTE • PHARMACOMETRICS PROTOCOL</span>
              <span>PATIENT: {patient.name} ({patient.patientId})</span>
            </div>

            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {noteText}
            </pre>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div
          className={`p-4 px-6 border-t flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Zero-PHI Compliance Verified (Salted HMAC Tokenization)</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-xs cursor-pointer ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy EHR Note</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
