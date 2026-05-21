import React, { useState } from 'react';
import { ViewState } from '../../types';
import { Button } from '../../components/Button';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { auth, db } from '../../firebaseConfig';
import { ChevronLeft, Loader2, Phone, AlertCircle } from 'lucide-react';

interface LoginProps {
  onNavigate: (view: ViewState) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // We append a domain to make the phone number work with Firebase Email Auth
  // This avoids the complexity of Captcha verification for prototype
  const getEmail = (phone: string) => `${phone}@medcare.app`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Register
        const userCredential = await createUserWithEmailAndPassword(auth, getEmail(phoneNumber), password);
        const user = userCredential.user;
        
        // Save extra profile data
        // Note: If this fails (e.g. permission-denied), the user is still created in Auth
        await updateProfile(user, { displayName: name });
        try {
            await setDoc(doc(db, "users", user.uid), {
              name: name,
              phoneNumber: phoneNumber,
              createdAt: new Date().toISOString()
            });
        } catch (dbError) {
            console.error("Firestore write failed:", dbError);
            // We continue even if DB write fails, as Auth succeeded
        }

      } else {
        // Login
        await signInWithEmailAndPassword(auth, getEmail(phoneNumber), password);
      }
      // Navigation is handled by the auth listener in App.tsx
    } catch (err: any) {
      console.error("Firebase Login Error:", err);
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid phone number or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This number is already registered. Please login.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('ERROR: Enable "Email/Password" in Firebase Console > Authentication > Sign-in method.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('ERROR: Firebase config not found. Check imports.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        // Show the raw error message for debugging
        setError(err.message || 'Connection failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="p-6">
        <button onClick={() => onNavigate(ViewState.LANDING)} className="text-slate-500 flex items-center gap-1 mb-6">
          <ChevronLeft size={20} /> Back
        </button>

        <div className="max-w-sm mx-auto mt-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">P</div>
            <span className="text-2xl font-bold text-slate-900">Prescription2Care</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-slate-600 mb-8">
            {isSignUp ? 'Enter your details to get started.' : 'Login to access your health records.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required={isSignUp}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="e.g. Sarah Jones"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                 <Phone className="absolute left-3 top-3.5 text-slate-400" size={18} />
                 <input 
                  type="tel" 
                  required
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value.replace(/\D/g,''))}
                  className="w-full pl-10 p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="10 digit number"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2 border border-red-100">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : (isSignUp ? 'Create Account' : 'Login')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              {isSignUp ? "Already have an account?" : "New to MedCare?"}
              <button 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="ml-1 font-bold text-primary-700 hover:underline"
              >
                {isSignUp ? "Login" : "Create Account"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};