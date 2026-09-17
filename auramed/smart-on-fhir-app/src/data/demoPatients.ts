export interface DemoPatient {
  id: string;
  patientId: string;
  mobile: string;
  name: string;
  gender: string;
  birthDate: string;
  mrn: string;
  condition: string;
  currentDrug: string;
  biomarkerName: string;
  unit: string;
  baselineValue: number;
  targetValue: string;
  pdcScore: number;
  coveredDaysCount: number;
  refillGapIndex: number;
  intervalVariance: number;
  divergenceSigma: string;
  entropy: string;
  conformalVerdict: 'INTERMITTENT' | 'CONCORDANT' | 'ABANDONED';
  pgxMetabolizer: string;
  egfrValue: string;
  cypPathways: string[];
}

export const DEMO_PATIENTS: Record<string, DemoPatient> = {
  mp001: {
    id: 'PAT-MP001',
    patientId: 'mp001',
    mobile: '9876543210',
    name: 'Dhyan Anchan',
    gender: 'male',
    birthDate: '1985-06-20',
    mrn: 'MRN-MP001-A',
    condition: 'Essential Stage-2 Hypertension',
    currentDrug: 'Lisinopril 20mg Oral Tablet',
    biomarkerName: 'Systolic Blood Pressure (SBP)',
    unit: 'mmHg',
    baselineValue: 152,
    targetValue: '~126 mmHg (-26 mmHg)',
    pdcScore: 0.522,
    coveredDaysCount: 47,
    refillGapIndex: 0.478,
    intervalVariance: 14.2,
    divergenceSigma: '+4.10σ',
    entropy: '0.07 ≤ 0.10',
    conformalVerdict: 'INTERMITTENT',
    pgxMetabolizer: 'CYP2D6 *1/*1 (Normal/Extensive)',
    egfrValue: '88 mL/min/1.73m² (Normal Clearance)',
    cypPathways: ['Hydrolyzed to Lisinoprilat', 'Minimal CYP450 Interaction', 'Renal Excretion (>95%)'],
  },
  mp002: {
    id: 'PAT-MP002',
    patientId: 'mp002',
    mobile: '9876543211',
    name: 'Anish',
    gender: 'male',
    birthDate: '1992-11-14',
    mrn: 'MRN-MP002-B',
    condition: 'Type 2 Diabetes Mellitus with Dyslipidemia',
    currentDrug: 'Metformin 500mg Extended Release',
    biomarkerName: 'Glycated Hemoglobin (HbA1c)',
    unit: '%',
    baselineValue: 9.4,
    targetValue: '~7.0% (-2.4%)',
    pdcScore: 0.485,
    coveredDaysCount: 44,
    refillGapIndex: 0.515,
    intervalVariance: 16.8,
    divergenceSigma: '+3.85σ',
    entropy: '0.08 ≤ 0.10',
    conformalVerdict: 'INTERMITTENT',
    pgxMetabolizer: 'OCT1/SLC22A1 Normal Transporter',
    egfrValue: '92 mL/min/1.73m² (Normal Clearance)',
    cypPathways: ['No Hepatic CYP450 Metabolism', 'Organic Cation Transporters (OCT1/2)', 'Unchanged Renal Excretion'],
  },
};

