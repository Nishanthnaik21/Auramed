import React, { useState } from 'react';
import { Check, Loader2, FileText, FlaskConical, Pill, Stethoscope, ArrowRight, ShieldAlert } from 'lucide-react';
import { smartFhir, ServiceRequestPayload } from '../fhir/client';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'LAB_ORDER' | 'TELEMETRY' | 'FORMULATION' | 'CONSULTATION';
  payload: ServiceRequestPayload;
  urgency: 'ROUTINE' | 'EVALUATION';
}

interface ClinicalActionPanelProps {
  theme?: 'light' | 'dark';
}

export const ClinicalActionPanel: React.FC<ClinicalActionPanelProps> = ({
  theme = 'light',
}) => {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDark = theme === 'dark';

  const actions: ActionItem[] = [
    {
      id: 'order-cmp',
      title: 'Order Comprehensive Metabolic Panel (CMP)',
      description: 'Assess hepatic transaminases & eGFR clearance capacity for active substrate metabolism.',
      category: 'LAB_ORDER',
      urgency: 'ROUTINE',
      payload: {
        code: '24323-8',
        display: 'Comprehensive Metabolic Panel (CMP)',
        system: 'http://loinc.org',
        reasonText: 'AuraMed Pharmacometrics Protocol: Evaluate metabolic clearance integrity & therapeutic discordance.',
      },
    },
    {
      id: 'order-rpm',
      title: 'Initiate Remote Blood Pressure Telemetry (RPM)',
      description: 'Continuous cellular home BP monitor to capture true outpatient daytime & nocturnal trajectory.',
      category: 'TELEMETRY',
      urgency: 'EVALUATION',
      payload: {
        code: '85354-9',
        display: 'Home Blood Pressure Telemetry Panel',
        system: 'http://loinc.org',
        reasonText: 'Establish continuous biomarker trajectory against counterfactual PK/PD prediction curves.',
      },
    },
    {
      id: 'switch-formulation',
      title: 'Switch to Once-Daily Fixed-Dose Combination',
      description: 'Consolidate multiple pill regimen into single morning dose to lower refill friction & entropy.',
      category: 'FORMULATION',
      urgency: 'ROUTINE',
      payload: {
        code: '905234',
        display: 'Lisinopril-Hydrochlorothiazide 20-12.5mg Oral Tablet',
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        reasonText: 'Regimen simplification to resolve intermittent refill lapse intervals.',
      },
    },
  ];

  const handleExecuteAction = async (action: ActionItem) => {
    setSubmittingId(action.id);
    setErrorMessage(null);

    try {
      const result = await smartFhir.submitServiceRequest(action.payload);
      if (result.success && result.id) {
        setCompletedActions((prev) => ({
          ...prev,
          [action.id]: result.id!,
        }));
      } else {
        setErrorMessage(result.error || 'Failed to submit order to EHR');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error communicating with FHIR client');
    } finally {
      setSubmittingId(null);
    }
  };

  const getCategoryIcon = (category: ActionItem['category']) => {
    switch (category) {
      case 'LAB_ORDER':
        return <FlaskConical className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-sky-600'}`} />;
      case 'TELEMETRY':
        return <Stethoscope className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />;
      case 'FORMULATION':
        return <Pill className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />;
      default:
        return <FileText className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />;
    }
  };

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
        className={`flex items-center justify-between mb-4 pb-4 border-b ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-xs'
            }`}
          >
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Actionable Clinical Suggestions
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Direct SMART-on-FHIR Order Dispatch • One-Click EHR Chart Integration
            </p>
          </div>
        </div>

        <div
          className={`flex items-center space-x-2 text-xs font-medium ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>EHR Connected</span>
        </div>
      </div>

      {errorMessage && (
        <div
          className={`mb-4 p-3 rounded-lg text-xs flex items-center space-x-2 border ${
            isDark
              ? 'bg-rose-950/40 border-rose-800 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Cards List */}
      <div className="space-y-3">
        {actions.map((action) => {
          const isCompleted = !!completedActions[action.id];
          const isSubmitting = submittingId === action.id;
          const orderId = completedActions[action.id];

          return (
            <div
              key={action.id}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isCompleted
                  ? isDark
                    ? 'bg-emerald-950/20 border-emerald-800/60'
                    : 'bg-emerald-50/70 border-emerald-200'
                  : isDark
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white shadow-xs'
              }`}
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-slate-800' : 'bg-slate-100 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(action.category)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4
                      className={`text-sm font-bold ${
                        isDark ? 'text-slate-200' : 'text-slate-900'
                      }`}
                    >
                      {action.title}
                    </h4>
                    <span
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                        isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {action.urgency}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-1 max-w-xl ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {action.description}
                  </p>
                  {isCompleted && (
                    <div
                      className={`text-[11px] font-mono mt-1.5 flex items-center space-x-1 font-semibold ${
                        isDark ? 'text-emerald-400' : 'text-emerald-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Order Placed in EHR (FHIR ID: {orderId})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Trigger Button */}
              <div className="flex-shrink-0 sm:self-center">
                {isCompleted ? (
                  <button
                    disabled
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-default border ${
                      isDark
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800/80'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Order Signed</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleExecuteAction(action)}
                    disabled={isSubmitting}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-white ${
                      isDark
                        ? 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/30'
                        : 'bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/20'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting to EHR...</span>
                      </>
                    ) : (
                      <>
                        <span>Authorize Order</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

