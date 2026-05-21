export enum ViewState {
  LANDING = 'LANDING',
  LOGIN = 'LOGIN',
  PATIENT_DASHBOARD = 'PATIENT_DASHBOARD',
  PATIENT_UPLOAD = 'PATIENT_UPLOAD',
}

export interface UserProfile {
  uid: string;
  displayName: string;
  phoneNumber: string;
}

export interface Medicine {
  med_name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PrescriptionParsedData {
  hospital_name: string;
  medicines: Medicine[];
  confidence_score: number;
  risk_flags?: string[];
}

export interface Reminder {
  id: string;
  med_name: string;
  dose: string;
  scheduled_time: string; // "09:00 AM"
  taken: boolean;
  date: string; // ISO date
}

export interface PatientRecord {
  id: string;
  hospital_name: string;
  diagnosis: string; // e.g., "Viral Fever", "Type 2 Diabetes"
  date_added: string;
  med_count: number;
  status: 'Ongoing Treatment' | 'Recovered' | 'Cured' | 'Maintenance';
  status_color: 'green' | 'blue' | 'orange' | 'slate';
  medicines?: Medicine[]; // Detailed medicines list
}

// For Charts
export interface AdherenceData {
  day: string;
  rate: number;
}