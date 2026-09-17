import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, Database, ThumbsUp, HelpCircle, FileCheck } from 'lucide-react';
import { DemoPatient } from '../data/demoPatients';

interface ClinicianFeedbackModalProps {
  patient: DemoPatient;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const ClinicianFeedbackModal: React.FC<ClinicianFeedbackModalProps> = ({
  patient,
  isOpen,
  onClose,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [selectedReason, setSelectedReason] = useState<string>('confirmed_gap');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#0f172a] border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 px-6 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/10 border border-purple-600/30 flex items-center justify-center text-purple-600">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Human-in-the-Loop Audit & Feedback</h3>
              <p className="text-xs text-slate-500">
                Calibrate conformal non-conformity threshold and log immutable audit record
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        {isSubmitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Feedback Logged & Model Calibrated
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Attending feedback for <strong>{patient.name} ({patient.patientId})</strong> has been hashed into the zero-PHI active learning retraining pipeline.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                Clinician Verdict on Adherence Discordance (+4.10σ):
              </label>
              <div className="space-y-2">
                {[
                  { id: 'confirmed_gap', title: 'Confirmed Outpatient Refill Lapse (True Positive)', desc: 'Patient verified pharmacy pickup delay or transportation barriers.' },
                  { id: 'hospitalized', title: 'Inpatient Hospitalization (False Positive Mitigation)', desc: 'Patient received medications inpatient during the recorded claims gap.' },
                  { id: 'holiday', title: 'Physician-Authorized Drug Holiday', desc: 'Dosing was intentionally paused by physician due to transient illness.' },
                  { id: 'adverse_event', title: 'Self-Tapered Due to Side Effects', desc: 'Patient experienced cough/dizziness and reduced frequency.' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`block p-3 rounded-xl border cursor-pointer transition ${
                      selectedReason === opt.id
                        ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="reason"
                        value={opt.id}
                        checked={selectedReason === opt.id}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">{opt.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 ml-5">{opt.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Optional Chart Notes:
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Add notes for the active learning audit log..."
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Audit Trail Note */}
            <div className="p-3 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>AUDIT ID: AUD-{Math.floor(100000 + Math.random() * 900000)}</span>
              <span>TOKEN: {patient.patientId} (HMAC-SHA256)</span>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
              >
                Submit Audit Record
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
