import { PatientRecord, Reminder } from "./types";

// Empty start for new users
export const MOCK_REMINDERS: Reminder[] = [];
export const MOCK_RECORDS: PatientRecord[] = [];

export const MOCK_DOCTORS_SEARCH = [
  { id: 'd1', name: 'Dr. Anjali Gupta', speciality: 'Cardiologist', clinic: 'Heart Care Clinic', distance: '0.8 km', rating: 4.9 },
  { id: 'd2', name: 'City Health Center', speciality: 'General Medicine', clinic: 'City Health', distance: '1.2 km', rating: 4.5 },
  { id: 'd3', name: 'Dr. Rajesh Kumar', speciality: 'Pediatrician', clinic: 'Little Smiles', distance: '2.5 km', rating: 4.8 },
  { id: 'd4', name: 'Green Cross Clinic', speciality: 'Diabetology', clinic: 'Green Cross', distance: '0.5 km', rating: 4.7 },
  { id: 'd5', name: 'Dr. Meera Reddy', speciality: 'Dermatologist', clinic: 'Skin & Glow', distance: '3.0 km', rating: 4.6 },
];