import React, { useState, useRef, useCallback } from 'react';
import { ViewState, PrescriptionParsedData, PatientRecord, Medicine } from '../../types';
import { fileToBase64, parsePrescriptionImage } from '../../services/geminiService';
import { scheduleMedicationAlarms } from '../../services/notificationService';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Camera, X, Loader2, AlertTriangle, Check, ChevronLeft, BellRing, FileText, CheckCircle, Upload, Plus, Keyboard, Image as ImageIcon, Trash2, Eye } from 'lucide-react';
import { auth, db } from '../../firebaseConfig';
import { doc, setDoc } from "firebase/firestore";

interface UploadFlowProps {
  onNavigate: (view: ViewState) => void;
  onAddRecord: (record: PatientRecord) => void;
}

export const UploadFlow: React.FC<UploadFlowProps> = ({ onNavigate, onAddRecord }) => {
  // Mode: 'scan' or 'manual'
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  
  // Steps
  const [step, setStep] = useState<'upload' | 'processing' | 'review' | 'success'>('upload');
  
  // Image Data
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  
  // Data
  const [parsedData, setParsedData] = useState<PrescriptionParsedData>({
      hospital_name: '',
      medicines: [],
      confidence_score: 1,
      risk_flags: []
  });
  
  // Manual Form State
  const [manualHospital, setManualHospital] = useState('');
  const [manualMeds, setManualMeds] = useState<Medicine[]>([
      { med_name: '', dose: '', frequency: '', duration: '', instructions: '' }
  ]);

  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  // --- Handlers for Image Flow ---

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
      setStep('processing');
      processImage(base64);
    } catch (err) {
      console.error("File read error", err);
      setError("Failed to read image file.");
    }
  };

  const processImage = useCallback(async (base64: string) => {
    try {
      const data = await parsePrescriptionImage(base64);
      setParsedData(data);
      setStep('review');
    } catch (error) {
      console.error("Processing failed", error);
      setError("Could not extract text. Please try a clearer image or switch to Manual Entry.");
      setStep('upload');
    }
  }, []);

  // --- Handlers for Manual Flow ---

  const addManualMed = () => {
      setManualMeds([...manualMeds, { med_name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  };

  const removeManualMed = (index: number) => {
      setManualMeds(manualMeds.filter((_, i) => i !== index));
  };

  const updateManualMed = (index: number, field: keyof Medicine, value: string) => {
      const newMeds = [...manualMeds];
      newMeds[index] = { ...newMeds[index], [field]: value };
      setManualMeds(newMeds);
  };

  const handleManualSubmit = () => {
      // Basic Validation
      if (!manualHospital.trim()) {
          setError("Please enter a hospital name.");
          return;
      }
      const validMeds = manualMeds.filter(m => m.med_name.trim() !== '');
      if (validMeds.length === 0) {
          setError("Please add at least one medicine.");
          return;
      }

      setParsedData({
          hospital_name: manualHospital,
          medicines: validMeds,
          confidence_score: 1.0,
          risk_flags: []
      });
      setStep('review'); // Go to review step to confirm
  };

  // --- Shared Confirm Handler ---

  const handleConfirm = async () => {
    if (!parsedData) return;
    
    // If offline or no auth, we can save to localStorage in a real app.
    // For this prototype, we require auth for Firestore.
    if (!auth.currentUser) {
        setError("You must be logged in to save records.");
        return;
    }

    setSaving(true);
    const recordId = crypto.randomUUID();
    const today = new Date().toISOString().split('T')[0];

    const newRecord: PatientRecord = {
        id: recordId,
        hospital_name: parsedData.hospital_name || "Unknown Hospital",
        diagnosis: "General Consultation", // Default
        date_added: today,
        med_count: parsedData.medicines.length,
        status: "Ongoing Treatment",
        status_color: "blue",
        medicines: parsedData.medicines
    };
    
    try {
        console.log("Saving to Firestore...");
        // 1. Save to Firestore
        await setDoc(doc(db, "users", auth.currentUser.uid, "records", recordId), newRecord);
        console.log("Saved to Firestore!");

        // 2. Schedule Native Alarms (CRITICAL STEP)
        // We calculate all future times and register them with the OS now.
        console.log("Attempting to register OS alarms...");
        await scheduleMedicationAlarms(newRecord);
        console.log("OS Alarms Registered!");

        // 3. Update App State
        onAddRecord(newRecord);
        setStep('success');
    } catch (e: any) {
        console.error("Error saving/scheduling: ", e);
        if (e.message.includes("offline") || e.code === 'unavailable') {
             console.warn("Offline mode: Saved locally (simulated)");
             onAddRecord(newRecord);
             setStep('success');
        } else {
             setError(`Save failed: ${e.message || "Unknown error"}`);
        }
        setSaving(false);
    }
  };

  // --- Render Blocks ---

  // 1. Mode Selection / Initial Upload Screen
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="p-4">
          <button onClick={() => onNavigate(ViewState.PATIENT_DASHBOARD)} className="text-slate-500 flex items-center gap-1 mb-4">
            <ChevronLeft size={20} /> Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Add Prescription</h1>
          
          {/* Mode Toggle */}
          <div className="flex bg-slate-200 p-1 rounded-xl mb-6">
              <button 
                onClick={() => setMode('scan')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === 'scan' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}
              >
                  <Camera size={16} /> Scan Image
              </button>
              <button 
                onClick={() => setMode('manual')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${mode === 'manual' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'}`}
              >
                  <Keyboard size={16} /> Manual Entry
              </button>
          </div>

          {error && (
                <div className="bg-red-50 p-3 rounded-lg text-red-600 text-sm mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
          )}

          {mode === 'scan' ? (
            <>
                <p className="text-slate-600 mb-8 text-center">Take a clear photo of the prescription to digitize it instantly.</p>
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-2xl bg-white p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-400 hover:bg-slate-50 transition-colors h-64 relative group"
                >
                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mb-4 group-hover:scale-110 transition-transform">
                        <Camera size={32} />
                    </div>
                    <h3 className="font-semibold text-slate-900">Tap to take photo</h3>
                    <p className="text-sm text-slate-500 mt-2">or select from gallery</p>
                    <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileChange}
                    />
                </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Hospital Name</label>
                    <input 
                        type="text" 
                        value={manualHospital}
                        onChange={(e) => setManualHospital(e.target.value)}
                        placeholder="e.g. Apollo Clinic"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                </div>
                
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">Medicines</label>
                    {manualMeds.map((med, idx) => (
                        <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 relative">
                            <button 
                                onClick={() => removeManualMed(idx)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                            >
                                <Trash2 size={16} />
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <input 
                                        placeholder="Medicine Name" 
                                        value={med.med_name}
                                        onChange={(e) => updateManualMed(idx, 'med_name', e.target.value)}
                                        className="w-full p-2 border-b border-slate-200 outline-none font-medium"
                                    />
                                </div>
                                <input 
                                    placeholder="Dose (e.g. 500mg)" 
                                    value={med.dose}
                                    onChange={(e) => updateManualMed(idx, 'dose', e.target.value)}
                                    className="w-full p-2 border-b border-slate-200 outline-none text-sm"
                                />
                                <input 
                                    placeholder="Freq (e.g. 1-0-1)" 
                                    value={med.frequency}
                                    onChange={(e) => updateManualMed(idx, 'frequency', e.target.value)}
                                    className="w-full p-2 border-b border-slate-200 outline-none text-sm"
                                />
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={addManualMed}
                        className="w-full py-3 border border-dashed border-primary-300 text-primary-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-50"
                    >
                        <Plus size={16} /> Add Another Medicine
                    </button>
                </div>

                <Button fullWidth size="lg" onClick={handleManualSubmit} className="mt-4">
                    Review & Save
                </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Processing Screen
  if (step === 'processing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full border-4 border-slate-100"></div>
          <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
          <Loader2 className="absolute inset-0 m-auto text-primary-600" size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Analyzing Prescription...</h2>
        <p className="text-slate-500 max-w-xs">MedCare AI is identifying medicines and instructions.</p>
      </div>
    );
  }

  // 3. Success Screen
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">All Done!</h1>
        <p className="text-slate-600 mb-8 text-lg">Your prescription has been saved.</p>
        <div className="w-full max-w-sm space-y-4 mb-10">
          <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-4 border border-slate-100">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-primary-700">
              <BellRing size={20} />
            </div>
            <div className="text-left">
              <h4 className="font-bold text-slate-900">Native Alarms Set</h4>
              <p className="text-xs text-slate-500">
                 Registered {parsedData?.medicines.length} alarms with Android/iOS.
              </p>
            </div>
            <div className="ml-auto text-green-600"><Check size={20} /></div>
          </div>
        </div>
        <Button size="lg" fullWidth className="max-w-sm" onClick={() => onNavigate(ViewState.PATIENT_DASHBOARD)}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  // 4. Review Screen
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <div className="bg-white px-4 py-4 border-b border-slate-200 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <button onClick={() => setStep('upload')}><ChevronLeft className="text-slate-500" /></button>
            <h1 className="font-bold text-slate-900">Verify Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Image Preview with Modal Trigger */}
        {mode === 'scan' && imagePreview && (
            <>
                <div 
                    className="h-40 bg-slate-900 rounded-xl overflow-hidden relative group cursor-pointer shadow-md"
                    onClick={() => setShowFullImage(true)}
                >
                    <img src={`data:image/jpeg;base64,${imagePreview}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Original" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <span className="text-white font-bold flex items-center gap-2"><Eye size={20}/> View Full Image</span>
                    </div>
                </div>

                {/* Full Image Modal */}
                {showFullImage && (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowFullImage(false)}>
                        <button className="absolute top-4 right-4 text-white p-2 bg-white/20 rounded-full"><X size={24}/></button>
                        <img src={`data:image/jpeg;base64,${imagePreview}`} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="Full Size" />
                    </div>
                )}
            </>
        )}

        {/* Hospital Info */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hospital</label>
            <input 
                type="text" 
                value={parsedData?.hospital_name} 
                onChange={(e) => setParsedData({...parsedData!, hospital_name: e.target.value})}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-primary-500 outline-none"
            />
        </div>

        {/* Medicines List */}
        <div>
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">Medicines</label>
            </div>
            
            <div className="space-y-3">
                {parsedData?.medicines.map((med, idx) => (
                    <Card key={idx} className="border-l-4 border-l-primary-500">
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12">
                                <input 
                                    value={med.med_name} 
                                    onChange={(e) => {
                                        const newMeds = [...parsedData.medicines];
                                        newMeds[idx].med_name = e.target.value;
                                        setParsedData({...parsedData, medicines: newMeds});
                                    }}
                                    className="w-full font-bold text-lg text-slate-900 bg-transparent border-b border-transparent focus:border-primary-500 outline-none" 
                                    placeholder="Medicine Name"
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Dose</label>
                                <input 
                                    value={med.dose} 
                                    onChange={(e) => {
                                        const newMeds = [...parsedData.medicines];
                                        newMeds[idx].dose = e.target.value;
                                        setParsedData({...parsedData, medicines: newMeds});
                                    }}
                                    className="w-full text-slate-700 bg-slate-50 p-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500" 
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Frequency</label>
                                <input 
                                    value={med.frequency} 
                                    onChange={(e) => {
                                        const newMeds = [...parsedData.medicines];
                                        newMeds[idx].frequency = e.target.value;
                                        setParsedData({...parsedData, medicines: newMeds});
                                    }}
                                    className="w-full text-slate-700 bg-slate-50 p-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500" 
                                />
                            </div>
                            <div className="col-span-4">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Duration</label>
                                <input 
                                    value={med.duration} 
                                    onChange={(e) => {
                                        const newMeds = [...parsedData.medicines];
                                        newMeds[idx].duration = e.target.value;
                                        setParsedData({...parsedData, medicines: newMeds});
                                    }}
                                    className="w-full text-slate-700 bg-slate-50 p-1 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500" 
                                />
                            </div>
                        </div>
                    </Card>
                ))}
                <Button 
                    variant="outline" 
                    fullWidth 
                    className="border-dashed py-3 text-slate-500 hover:text-primary-600"
                    onClick={() => {
                        const newMeds = [...parsedData!.medicines, { med_name: '', dose: '', frequency: '', duration: '', instructions: '' }];
                        setParsedData({...parsedData!, medicines: newMeds});
                    }}
                >
                    + Add Missing Medicine
                </Button>
            </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 shadow-lg z-20">
          <Button 
            fullWidth 
            size="lg" 
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? <Loader2 className="animate-spin" /> : 'Confirm & Save'}
          </Button>
      </div>
    </div>
  );
};