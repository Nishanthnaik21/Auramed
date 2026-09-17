import React from 'react';
import { X, Network, ShieldCheck, CheckCircle2, AlertCircle, Dna, FlaskConical, ArrowRight } from 'lucide-react';
import { DemoPatient } from '../data/demoPatients';

interface PharmacologyContradictionModalProps {
  patient: DemoPatient;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const PharmacologyContradictionModal: React.FC<PharmacologyContradictionModalProps> = ({
  patient,
  isOpen,
  onClose,
  theme,
}) => {
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
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
            <div className="w-8 h-8 rounded-lg bg-teal-600/10 border border-teal-600/30 flex items-center justify-center text-teal-600">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">Neo4j Pharmacology & Contradiction Engine</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800">
                  Cypher Graph Traverse Active
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rule-out alternative biological mechanisms: CYP450 metabolism, organ clearance, and competitor interactions
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed">
          {/* Visual Interactive Graph Canvas */}
          <div
            className={`p-4 rounded-xl border ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3 text-[11px] font-mono text-slate-500">
              <span>NEO4J KNOWLEDGE GRAPH DISPOSITION MAP</span>
              <span className="text-sky-600 font-bold">Patient: {patient.name} ({patient.patientId})</span>
            </div>

            {/* SVG Graph Topology */}
            <div className="relative overflow-x-auto select-none py-2">
              <svg viewBox="0 0 680 170" className="w-full h-auto min-w-[580px]">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#0284c7" />
                  </marker>
                </defs>

                {/* Edges */}
                <line x1="140" y1="85" x2="310" y2="40" stroke="#0284c7" strokeWidth="1.8" strokeDasharray="4 2" markerEnd="url(#arrow)" />
                <line x1="140" y1="85" x2="310" y2="130" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#arrow)" />
                <line x1="430" y1="40" x2="550" y2="85" stroke="#10b981" strokeWidth="1.8" markerEnd="url(#arrow)" />
                <line x1="430" y1="130" x2="550" y2="85" stroke="#10b981" strokeWidth="1.8" markerEnd="url(#arrow)" />

                {/* Edge Labels */}
                <text x="215" y="52" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">MODULATES</text>
                <text x="215" y="120" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">CLEARANCE_VIA</text>
                <text x="495" y="52" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">TARGET_RESPONSE</text>
                <text x="495" y="120" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">ELIMINATED</text>

                {/* Node 1: Drug */}
                <rect x="20" y="60" width="120" height="50" rx="8" fill={isDark ? '#1e293b' : '#ffffff'} stroke="#0284c7" strokeWidth="2" />
                <text x="80" y="82" fill={isDark ? '#ffffff' : '#0f172a'} fontSize="11" fontWeight="bold" textAnchor="middle">{patient.currentDrug.split(' ')[0]}</text>
                <text x="80" y="97" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">RxNorm Active</text>

                {/* Node 2: Biomarker Target */}
                <rect x="310" y="18" width="120" height="46" rx="8" fill={isDark ? '#1e293b' : '#ffffff'} stroke="#0284c7" strokeWidth="1.5" />
                <text x="370" y="38" fill={isDark ? '#ffffff' : '#0f172a'} fontSize="10" fontWeight="bold" textAnchor="middle">{patient.biomarkerName.split(' ')[0]}</text>
                <text x="370" y="51" fill="#64748b" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">LOINC Target</text>

                {/* Node 3: Clearance Pathway */}
                <rect x="310" y="108" width="120" height="46" rx="8" fill={isDark ? '#1e293b' : '#ffffff'} stroke="#0d9488" strokeWidth="1.5" />
                <text x="370" y="128" fill={isDark ? '#ffffff' : '#0f172a'} fontSize="10" fontWeight="bold" textAnchor="middle">Renal/Clearance</text>
                <text x="370" y="141" fill="#64748b" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">{patient.egfrValue.split(' ')[0]} eGFR</text>

                {/* Node 4: Expected Physiological State */}
                <rect x="550" y="60" width="115" height="50" rx="8" fill={isDark ? '#134e4a' : '#ecfdf5'} stroke="#10b981" strokeWidth="2" />
                <text x="607" y="82" fill={isDark ? '#34d399' : '#047857'} fontSize="11" fontWeight="bold" textAnchor="middle">Expected ŷ</text>
                <text x="607" y="97" fill={isDark ? '#a7f3d0' : '#059669'} fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle">{patient.targetValue.split(' ')[0]}</text>
              </svg>
            </div>
          </div>

          {/* Contradiction Reasoning Checklist */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Contradiction Agent Automated Rule-Out Checklist
            </h4>
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Rule 1: CYP450 Enzyme Induction / Inhibition Check — PASSED (Negative)
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    FHIR MedicationStatement scanned across 14 co-prescriptions. Zero active CYP3A4, CYP2C9, or CYP2D6 competitive inhibitors (e.g. Ketoconazole, Amiodarone, Fluconazole) detected.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Rule 2: Organ Clearance & Excretion Capacity — PASSED (Intact)
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    Active eGFR is calibrated at <strong>{patient.egfrValue}</strong>. Renal excretion kinetics show no pathological drug accumulation or excessive ultrafiltration.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/20 flex items-start space-x-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Rule 3: Pharmacogenomic (PGx) Metabolism Phenotype — PASSED (Extensive)
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                    Patient genotype confirmed as <strong>{patient.pgxMetabolizer}</strong>. Normal enzymatic transformation rules out congenital poor-metabolizer resistance.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final Conformal Verdict Callout */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div>
              <span className="font-bold text-slate-900 dark:text-white">
                Contradiction Synthesis:
              </span>{' '}
              <span className="text-slate-600 dark:text-slate-400">
                All alternative pharmacokinetic hypotheses refuted. Mahalanobis divergence ({patient.divergenceSigma}) is conclusively attributable to unmedicated pharmacy refill gap lapses.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 px-6 border-t flex items-center justify-between text-xs ${
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-2 text-emerald-600 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Cypher Subgraph Traversal Synced with Local Graph Core</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm transition"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
