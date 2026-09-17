import React, { useState } from 'react';
import { X, Send, MessageSquare, CheckCheck, Phone, ShieldCheck, Sparkles, Pill, HeartHandshake } from 'lucide-react';
import { DemoPatient } from '../data/demoPatients';

interface PatientOutreachModalProps {
  patient: DemoPatient;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const PatientOutreachModal: React.FC<PatientOutreachModalProps> = ({
  patient,
  isOpen,
  onClose,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [messages, setMessages] = useState<Array<{ sender: 'clinic' | 'patient'; text: string; time: string }>>([
    {
      sender: 'clinic',
      text: `Hello ${patient.name}, this is your clinical care team at Manipal Health. We noticed from pharmacy records that your refill for ${patient.currentDrug} might have had a brief lapse recently. We want to ensure you're feeling well and having no side effects!`,
      time: '10:14 AM',
    },
    {
      sender: 'clinic',
      text: `To make things easier, we can arrange a 90-day home delivery or switch you to a once-daily combined pill so you don't have to juggle multiple pharmacy visits. Reply '1' for home refill, '2' for combined pill, or '3' to speak with your nurse.`,
      time: '10:15 AM',
    },
  ]);
  const [patientReplied, setPatientReplied] = useState(false);
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSimulateReply = () => {
    if (patientReplied) return;
    setPatientReplied(true);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'patient',
        text: `Hi Nurse, thank you for checking in. Between work and travel I missed picking up the second refill last month. I would love to switch to the once-daily combined pill so I only have to remember one in the morning!`,
        time: '10:22 AM',
      },
      {
        sender: 'clinic',
        text: `Wonderful, ${patient.name}! Your physician has authorized the once-daily formulation switch. It has been transmitted to your preferred pharmacy for pickup today. Take care!`,
        time: '10:24 AM',
      },
    ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        sender: 'clinic',
        text: inputText.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#0f172a] border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Smartphone / Chat Header */}
        <div
          className={`p-4 px-5 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-sky-600 text-white'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {patient.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute bottom-0 right-0 ring-2 ring-white"></span>
            </div>
            <div>
              <div className="font-bold text-sm">{patient.name}</div>
              <div className="text-[11px] opacity-80 flex items-center space-x-1 font-mono">
                <Phone className="w-3 h-3" />
                <span>{patient.mobile} • Patient ID: {patient.patientId}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition opacity-80 hover:opacity-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Non-Punitive Philosophy Callout */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center space-x-2">
          <HeartHandshake className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Non-Punitive Outreach Active:</strong> Message removes stigma, focusing on regimen convenience and tolerability rather than compliance blame.
          </span>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/60 dark:bg-slate-950/60 text-xs">
          {messages.map((m, idx) => {
            const isClinic = m.sender === 'clinic';
            return (
              <div key={idx} className={`flex flex-col ${isClinic ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] p-3 rounded-2xl shadow-xs leading-relaxed ${
                    isClinic
                      ? 'bg-sky-600 text-white rounded-br-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <p>{m.text}</p>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1 px-1">
                  <span>{m.time}</span>
                  {isClinic && <CheckCheck className="w-3 h-3 text-sky-500" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Simulated Patient Response Button */}
        {!patientReplied && (
          <div className="p-2.5 px-4 bg-sky-50 dark:bg-sky-950/40 border-t border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs">
            <span className="text-[11px] text-sky-800 dark:text-sky-300 font-medium flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Simulate Inbound Patient Reply:
            </span>
            <button
              onClick={handleSimulateReply}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition"
            >
              Simulate "Switch to 1 Pill"
            </button>
          </div>
        )}

        {/* Text Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center space-x-2 bg-white dark:bg-slate-900">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a clinical message..."
            className={`flex-1 px-3 py-2 text-xs rounded-xl border ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
            } focus:outline-none focus:ring-1 focus:ring-sky-500`}
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
