import React from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Activity, ShieldCheck, Smartphone, MapPin } from 'lucide-react';

interface LandingProps {
  onNavigate: (view: ViewState) => void;
}

export const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="p-4 md:p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span className="text-xl font-bold text-slate-900">Prescription2Care</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-3xl mx-auto">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium border border-primary-100">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
          Your Personal Health Companion
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
          Turn Paper Prescriptions into <span className="text-primary-600">Active Care</span>.
        </h1>
        
        <p className="text-lg text-slate-600 mb-10 max-w-2xl leading-relaxed">
          Simply snap a photo of your prescription. MedCare extracts your medicines, sets automated reminders, and tracks your recovery journey. Connect with high-impact local clinics instantly. No typing required.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <Button size="lg" fullWidth className="px-12" onClick={() => onNavigate(ViewState.LOGIN)}>
            Get Started
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
              <Smartphone size={20} />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Instant Digitization</h3>
            <p className="text-sm text-slate-600">Upload a photo and let MedCare parse complex medical handwriting in seconds.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Zero-Error Verification</h3>
            <p className="text-sm text-slate-600">Automated risk checks and easy confirmation ensure your medication schedule is accurate.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4">
              <MapPin size={20} />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Local Care Impact</h3>
            <p className="text-sm text-slate-600">Track your health timeline and discover how local clinics provide world-class recovery results.</p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-slate-400 text-sm">
        © 2024 Prescription2Care. Powered by MedCare AI.
      </footer>
    </div>
  );
};