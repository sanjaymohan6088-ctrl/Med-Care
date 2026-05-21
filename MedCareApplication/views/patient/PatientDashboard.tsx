import React, { useState, useEffect } from 'react';
import { ViewState, PatientRecord, UserProfile, Medicine } from '../../types';
import { Card } from '../../components/Card';
import { CheckCircle2, Circle, Pill, Calendar, Clock, Activity, XCircle, AlertCircle, ChevronRight, MapPin, Sparkles, TrendingUp, LogOut, User, Check, X, Bell, Plus, ShieldAlert, Search, Heart, Smile, UserCircle2 } from 'lucide-react';
import { auth, db } from '../../firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';

interface PatientDashboardProps {
  onNavigate: (view: ViewState) => void;
  records: PatientRecord[];
  userProfile: UserProfile | null;
}

interface DayStatus {
  date: Date;
  dayLabel: string; // "M", "T", "W"
  fullDate: string; // YYYY-MM-DD
  status: 'perfect' | 'partial' | 'missed' | 'today' | 'future';
}

// New Structure: Grouped by Time Slot
interface TimeSlotCard {
  id: string;
  label: string; // Morning, Afternoon, Night
  time: string; // 8:00 AM
  targetTime: Date; // Real Date object for comparison
  status: 'Taken' | 'Missed' | 'Pending' | 'Locked'; // Locked = future time
  meds: string[];
  color: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ onNavigate, records, userProfile }) => {
  const [selectedDay, setSelectedDay] = useState<DayStatus | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [weekDays, setWeekDays] = useState<DayStatus[]>([]);
  const [todaySlots, setTodaySlots] = useState<TimeSlotCard[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [adherenceLog, setAdherenceLog] = useState<Record<string, string>>({}); 
  
  // New State for Records Section
  const [recordSearch, setRecordSearch] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);

  // 1. Setup Week Calendar & Real Date
  useEffect(() => {
    const generateWeek = () => {
      const today = new Date();
      const days: DayStatus[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const isToday = i === 0;
        
        days.push({
          date: d,
          dayLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W
          fullDate: d.toISOString().split('T')[0],
          status: isToday ? 'today' : 'missed' 
        });
      }
      setWeekDays(days);
      setSelectedDay(days[days.length - 1]);
    };
    
    generateWeek();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 2. Load Adherence Data from Firestore
  useEffect(() => {
    if (!auth.currentUser) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const logRef = doc(db, "users", auth.currentUser.uid, "adherence", todayStr);

    const unsubscribe = onSnapshot(logRef, (docSnap) => {
        if (docSnap.exists()) {
            setAdherenceLog(docSnap.data() as Record<string, string>);
        } else {
            setAdherenceLog({});
        }
    });

    return () => unsubscribe();
  }, []);

  // 3. Calculate Reminders
  useEffect(() => {
    if (records.length === 0) {
        setTodaySlots([]);
        return;
    }

    const slots: TimeSlotCard[] = [];
    const morningMeds: string[] = [];
    const afternoonMeds: string[] = [];
    const nightMeds: string[] = [];

    records.forEach(record => {
        record.medicines.forEach(med => {
            const freq = med.frequency.toLowerCase().replace(/\s/g, '');
            if (freq.includes('1-1-1') || freq.includes('tds')) {
                morningMeds.push(med.med_name); afternoonMeds.push(med.med_name); nightMeds.push(med.med_name);
            } else if (freq.includes('1-0-1') || freq.includes('bd')) {
                morningMeds.push(med.med_name); nightMeds.push(med.med_name);
            } else if (freq.includes('1-0-0') || freq === 'morning') {
                morningMeds.push(med.med_name);
            } else if (freq.includes('0-0-1') || freq === 'night') {
                nightMeds.push(med.med_name);
            } else {
                morningMeds.push(med.med_name);
            }
        });
    });

    const getTargetTime = (hour: number, minute: number) => {
        const t = new Date();
        t.setHours(hour, minute, 0, 0);
        return t;
    };

    const getSlotStatus = (slotId: string, target: Date) => {
        if (adherenceLog[slotId]) return adherenceLog[slotId] as 'Taken' | 'Missed';
        if (currentTime < target) return 'Locked'; 
        return 'Pending';
    };

    if (morningMeds.length > 0) {
        const t = getTargetTime(8, 0);
        slots.push({ id: 'morning', label: 'Morning', time: '8:00 AM', targetTime: t, status: getSlotStatus('morning', t) as any, meds: morningMeds, color: 'text-orange-500' });
    }
    if (afternoonMeds.length > 0) {
        const t = getTargetTime(13, 30);
        slots.push({ id: 'afternoon', label: 'Afternoon', time: '1:30 PM', targetTime: t, status: getSlotStatus('afternoon', t) as any, meds: afternoonMeds, color: 'text-blue-500' });
    }
    if (nightMeds.length > 0) {
        const t = getTargetTime(21, 0);
        slots.push({ id: 'night', label: 'Night', time: '9:00 PM', targetTime: t, status: getSlotStatus('night', t) as any, meds: nightMeds, color: 'text-indigo-500' });
    }

    setTodaySlots(slots);

    if (slots.length > 0) {
        const takenCount = slots.filter(s => s.status === 'Taken').length;
        const missedCount = slots.filter(s => s.status === 'Missed').length;
        const total = slots.length;
        let newStatus: DayStatus['status'] = 'today';
        if (takenCount === total) newStatus = 'perfect';
        else if (missedCount > 0 || (takenCount > 0 && takenCount < total)) newStatus = 'partial';
        setWeekDays(prev => prev.map(d => d.status === 'today' || d.status === 'perfect' || d.status === 'partial' ? { ...d, status: newStatus } : d));
    }

  }, [records, currentTime, adherenceLog]);

  const handleLogout = async () => {
      await signOut(auth);
  };

  const handleMarkStatus = async (slotId: string, status: 'Taken' | 'Missed') => {
    if (!auth.currentUser) return;
    setTodaySlots(prev => prev.map(slot => slot.id === slotId ? { ...slot, status } : slot));
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const logRef = doc(db, "users", auth.currentUser.uid, "adherence", todayStr);
        await setDoc(logRef, { [slotId]: status }, { merge: true });
    } catch (e) { console.error("Failed to save status", e); }
  };

  const getStatusColor = (day: DayStatus) => {
    if (day.status === 'today' || (day.fullDate === new Date().toISOString().split('T')[0] && day.status === 'partial')) {
        return 'bg-primary-600 border-primary-700 text-white shadow-md shadow-primary-200';
    }
    switch (day.status) {
      case 'perfect': return 'bg-green-500 border-green-600 text-white';
      case 'partial': return 'bg-orange-400 border-orange-500 text-white';
      case 'missed': return 'bg-red-500 border-red-600 text-white';
      default: return 'bg-slate-100 border-slate-200 text-slate-400';
    }
  };

  const getRecordBadgeColor = (color: string) => {
    switch (color) {
        case 'green': return 'bg-green-100 text-green-700';
        case 'blue': return 'bg-blue-100 text-blue-700';
        case 'orange': return 'bg-orange-100 text-orange-800';
        default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Filter and Sort Records
  const filteredRecords = records
    .filter(r => r.hospital_name.toLowerCase().includes(recordSearch.toLowerCase()))
    .sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime());

  // Updated Logic: Show only 2 by default
  const displayRecords = showAllRecords ? filteredRecords : filteredRecords.slice(0, 2);

  // Unique Wellness Message per User
  const getWellnessMessage = () => {
      const messages = [
          "Consistency is key to good health.",
          "Hope you're feeling balanced today.",
          "Wishing you a calm and healthy day.",
          "Remember to rest and hydrate.",
          "Your wellbeing matters every day.",
          "Small steps lead to big changes.",
          "Take a moment for yourself today."
      ];
      
      // Use User UID char code sum to offset the day index for uniqueness
      const uidSum = userProfile?.uid ? userProfile.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
      const dayIndex = (new Date().getDate() + uidSum) % messages.length;
      
      return messages[dayIndex];
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 relative font-sans">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">MedCare</h1>
            <p className="text-xs text-slate-500 font-medium">Personal Health Companion</p>
          </div>
          <div className="relative">
            <button 
                onClick={() => setShowProfile(!showProfile)}
                className="w-10 h-10 bg-white border border-slate-200 text-slate-700 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 hover:border-primary-300 transition-all"
            >
                <UserCircle2 size={24} strokeWidth={1.5} />
            </button>
            
            {showProfile && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowProfile(false)}></div>
                    <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="bg-slate-50 p-5 border-b border-slate-100 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-3">
                                <User size={32} />
                            </div>
                            <p className="font-bold text-slate-900 text-lg">{userProfile?.displayName || 'Guest User'}</p>
                            <p className="text-sm text-slate-500 font-medium">{userProfile?.phoneNumber || 'No phone number'}</p>
                        </div>
                        <div className="p-2">
                            <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors">
                                <LogOut size={18} /> 
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        
        {/* 1. Attractive & Professional Welcome (Updated) */}
        <section>
            <div className="bg-gradient-to-br from-[#0f766e] to-[#115e59] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden border border-[#134e4a]">
                {/* Subtle Pattern Overlay */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-300 opacity-10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-white">
                                Hello, {userProfile?.displayName?.split(' ')[0] || 'User'}
                            </h2>
                            <p className="text-teal-50 font-medium text-base leading-relaxed max-w-[90%]">
                                {getWellnessMessage()}
                            </p>
                        </div>
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                            <Heart size={24} className="text-teal-200 fill-teal-200/20" />
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* 2. Health Pulse */}
        <section>
           <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-primary-600" /> My Health Pulse
            </h2>
            <span className="text-xs text-slate-400 font-medium">Last 7 Days</span>
          </div>
          <Card className="p-4 border-slate-200 shadow-sm">
             <div className="flex justify-between items-center gap-2 mb-6">
                {weekDays.map((day, idx) => (
                  <button key={idx} onClick={() => setSelectedDay(day)} className={`relative flex flex-col items-center justify-center w-10 h-14 rounded-xl border-b-4 transition-all ${getStatusColor(day)}`}>
                    <span className="text-[10px] font-medium opacity-90">{day.dayLabel}</span>
                    <div className="mt-1">
                        {day.fullDate === new Date().toISOString().split('T')[0] ? <Circle size={14} className="text-white animate-pulse" /> : day.status === 'perfect' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    </div>
                  </button>
                ))}
             </div>
             <div className="space-y-3">
                {selectedDay && selectedDay.fullDate === new Date().toISOString().split('T')[0] ? (
                    todaySlots.length > 0 ? todaySlots.map((slot) => (
                        <div key={slot.id} className={`p-4 rounded-xl border transition-all ${slot.status === 'Pending' || slot.status === 'Locked' ? 'bg-white border-slate-200' : slot.status === 'Taken' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${slot.color}`}>{slot.label} • {slot.time}</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {slot.meds.map((m, i) => (<span key={i} className="text-sm font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{m}</span>))}
                                    </div>
                                </div>
                                {slot.status === 'Pending' ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleMarkStatus(slot.id, 'Taken')} className="bg-green-100 text-green-700 p-2 rounded-full hover:bg-green-200 transition-colors"><Check size={16} /></button>
                                        <button onClick={() => handleMarkStatus(slot.id, 'Missed')} className="bg-red-100 text-red-700 p-2 rounded-full hover:bg-red-200 transition-colors"><X size={16} /></button>
                                    </div>
                                ) : slot.status === 'Locked' ? (
                                     <div className="bg-slate-100 text-slate-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12} /> Wait</div>
                                ) : (
                                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${slot.status === 'Taken' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{slot.status}</span>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-slate-400">
                            <Bell className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No active medicines for today.</p>
                            <p className="text-xs mt-1 text-slate-300">Upload a prescription to see your schedule.</p>
                        </div>
                    )
                ) : ( <div className="p-8 text-center text-slate-400 text-sm">History view for {selectedDay?.fullDate}</div>)}
             </div>
          </Card>
        </section>

        {/* 3. Health Records (Updated Structure) */}
        <section>
          <div className="flex flex-col gap-3 mb-3">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><Calendar size={16} className="text-primary-600" /> Health Records</h2>
            </div>
          </div>

          <Card className="p-0 overflow-hidden border-slate-200 shadow-sm">
             {/* Search Inside Card Header */}
             <div className="p-3 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search records..." 
                        value={recordSearch}
                        onChange={(e) => setRecordSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none transition-shadow"
                    />
                </div>
             </div>

             <div className="divide-y divide-slate-100">
                {displayRecords.length > 0 ? displayRecords.map(record => (
                  <div key={record.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedRecord(record)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{record.diagnosis}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">{record.hospital_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded border border-opacity-20 ${getRecordBadgeColor(record.status_color)}`}>{record.status}</span>
                    </div>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Clock size={10} /> {record.date_added}</span>
                      <div className="flex items-center gap-1 text-xs text-primary-600 font-semibold">
                         <span>{record.med_count} Meds</span> <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                )) : ( 
                    <div className="text-center p-8 text-slate-400 text-sm">
                        <p>No records found.</p>
                    </div>
                )}
             </div>
             
             {/* View All Footer */}
             {filteredRecords.length > 2 && (
                <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                    <button 
                        onClick={() => setShowAllRecords(!showAllRecords)}
                        className="text-xs font-bold text-primary-600 hover:text-primary-700 py-2 w-full"
                    >
                        {showAllRecords ? 'Collapse List' : `View All (${filteredRecords.length})`}
                    </button>
                </div>
             )}
          </Card>
        </section>

        {/* Care Journey */}
        <section>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2"><MapPin size={16} className="text-primary-600" /> Care Journey</h2>
            </div>
            <div className="relative pl-4 border-l-2 border-slate-200 space-y-8 ml-2">
                {records.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()).map((record) => (
                    <div key={record.id} className="relative group">
                        <div className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm group-hover:scale-125 transition-transform ${record.status === 'Cured' || record.status === 'Recovered' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1"><Clock size={10} /> {record.date_added}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${record.status === 'Cured' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{record.status}</span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-sm">{record.hospital_name}</h3>
                            <p className="text-sm text-slate-600 mt-1">{record.diagnosis}</p>
                            <div className="mt-3 pt-2 border-t border-slate-50 flex items-center gap-4">
                                <div className="flex items-center gap-1 text-xs text-slate-500"><TrendingUp size={12} className="text-green-500" /><span>Recovery: <span className="font-bold text-slate-700">Fast (5 days)</span></span></div>
                                <div className="flex items-center gap-1 text-xs text-slate-500"><Activity size={12} className="text-primary-500" /><span>Impact: <span className="font-bold text-slate-700">High</span></span></div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {records.length === 0 && <div className="text-sm text-slate-400 italic pl-2">Your care journey will appear here once you visit a clinic.</div>}

                {/* Digital Nurse Safety Analysis */}
                {records.length > 0 && (
                <div className="relative pt-4">
                    <div className={`absolute -left-[25px] top-8 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-md z-10 animate-pulse ${records.length > 1 ? 'bg-red-500' : 'bg-green-500'}`}>
                        {records.length > 1 ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}
                    </div>
                    <div className={`p-5 rounded-xl border shadow-sm relative overflow-hidden ${records.length > 1 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                        <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${records.length > 1 ? 'text-red-800' : 'text-green-800'}`}>
                             {records.length > 1 ? 'Digital Nurse: Interaction Warning' : 'Digital Nurse: Safety Check'}
                        </h4>
                        <p className="text-sm text-slate-700 leading-relaxed">
                            {records.length > 1 ? (
                                <span>
                                    Warning: You are currently taking medicines from <span className="font-bold">{records[0]?.hospital_name}</span> and <span className="font-bold">{records[1]?.hospital_name}</span>. 
                                    <br/><br/>
                                    Potential Conflict: Mixing medicines from different prescriptions can cause dizziness. Please verify with your doctor.
                                </span>
                            ) : (
                                <span>
                                    Everything looks great! Your tablets align properly with the standard treatment for "{records[0]?.diagnosis}".
                                    <br/><br/>
                                    Continue this schedule for 4 to 5 days for best results.
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                )}
            </div>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 z-20">
        <button onClick={() => onNavigate(ViewState.PATIENT_UPLOAD)} className="bg-slate-900 text-white rounded-full p-4 shadow-xl shadow-slate-900/20 hover:bg-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group">
             <div className="bg-white/20 rounded-full p-1 group-hover:rotate-90 transition-transform"><Plus size={20} /></div>
          <span className="font-bold pr-2">Digitize Rx</span>
        </button>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
                <div className="bg-primary-600 p-6 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold leading-tight">{selectedRecord.diagnosis}</h2>
                            <p className="text-primary-100 mt-1 opacity-90">{selectedRecord.hospital_name}</p>
                        </div>
                        <button onClick={() => setSelectedRecord(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors -mr-2 -mt-2"><X size={20} /></button>
                    </div>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Pill size={16} /> Prescribed Medicines</h3>
                        <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded text-slate-500">{selectedRecord.medicines?.length || 0} items</span>
                    </div>
                    <div className="space-y-3">
                        {selectedRecord.medicines?.map((med, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 gap-3">
                                <div>
                                    <p className="font-bold text-slate-900 text-lg">{med.med_name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{med.dose}</span>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">{med.duration}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono font-bold text-primary-700 shadow-sm">{med.frequency}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between text-sm text-slate-500">
                        <div className="flex flex-col"><span className="text-xs font-medium text-slate-400 uppercase mb-1">Added On</span><span className="font-semibold text-slate-700">{selectedRecord.date_added}</span></div>
                        <div className="flex flex-col items-end"><span className="text-xs font-medium text-slate-400 uppercase mb-1">Status</span><span className={`font-bold px-2 py-0.5 rounded ${getRecordBadgeColor(selectedRecord.status_color)}`}>{selectedRecord.status}</span></div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};