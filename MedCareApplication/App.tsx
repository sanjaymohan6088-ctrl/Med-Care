import React, { useState, useEffect } from 'react';
import { ViewState, PatientRecord, UserProfile } from './types';
import { Landing } from './views/Landing';
import { Login } from './views/auth/Login';
import { PatientDashboard } from './views/patient/PatientDashboard';
import { UploadFlow } from './views/patient/UploadFlow';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { Loader2 } from 'lucide-react';
import { initializeNotificationListeners } from './services/notificationService'; // Import Listener

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LANDING);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [patientRecords, setPatientRecords] = useState<PatientRecord[]>([]);

  useEffect(() => {
    // Initialize Native Notification Listeners (simulated in web)
    initializeNotificationListeners();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch Profile
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const userData = userDoc.data();
          setUserProfile({
            uid: user.uid,
            displayName: userData?.name || user.displayName || "User",
            phoneNumber: userData?.phoneNumber || ""
          });

          // Fetch Records
          const recordsSnap = await getDocs(collection(db, "users", user.uid, "records"));
          const records: PatientRecord[] = [];
          recordsSnap.forEach((doc) => {
            records.push(doc.data() as PatientRecord);
          });
          setPatientRecords(records);
        } catch (e) {
          console.error("Error fetching user data:", e);
        }

        setCurrentView(ViewState.PATIENT_DASHBOARD);
      } else {
        setUserProfile(null);
        setPatientRecords([]);
        setCurrentView(ViewState.LANDING);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddRecord = (record: PatientRecord) => {
    setPatientRecords(prev => [record, ...prev]);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-primary-600">
        <Loader2 size={48} className="animate-spin" />
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case ViewState.LANDING:
        return <Landing onNavigate={setCurrentView} />;
      case ViewState.LOGIN:
        return <Login onNavigate={setCurrentView} />;
      case ViewState.PATIENT_DASHBOARD:
        return (
          <PatientDashboard 
            onNavigate={setCurrentView} 
            records={patientRecords} 
            userProfile={userProfile}
          />
        );
      case ViewState.PATIENT_UPLOAD:
        return (
          <UploadFlow 
            onNavigate={setCurrentView} 
            onAddRecord={handleAddRecord}
          />
        );
      default:
        return <Landing onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="font-sans text-slate-900 antialiased">
      {renderView()}
    </div>
  );
};

export default App;