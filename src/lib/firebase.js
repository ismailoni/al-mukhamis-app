import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyCjdhv5OnhfjEhrOkHKe2agd0cO1WeVaj0",
  authDomain: "al-mukhamis-system.firebaseapp.com",
  projectId: "al-mukhamis-system",
  storageBucket: "al-mukhamis-system.firebasestorage.app",
  messagingSenderId: "780858034254",
  appId: "1:780858034254:web:24b735f4cbce3a00431b1f",
  measurementId: "G-CTKLVE0WPB"
};

// Initialize Firebase

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);