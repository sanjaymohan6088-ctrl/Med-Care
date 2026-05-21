import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC4J_fEKRPy9lJ-5N7bxqxTrRIE_Q6h7Yw",
  authDomain: "medcare-4b36b.firebaseapp.com",
  projectId: "medcare-4b36b",
  storageBucket: "medcare-4b36b.firebasestorage.app",
  messagingSenderId: "490945687994",
  appId: "1:490945687994:web:065a9079042fc8634a6d83",
  measurementId: "G-1V772S3JXF"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Pass the app instance to ensure it uses the correct config context
export const auth = getAuth(app);
export const db = getFirestore(app);