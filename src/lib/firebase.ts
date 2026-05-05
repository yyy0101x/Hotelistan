import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signInAnonymously, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, query, where, orderBy, Timestamp, getDocFromServer, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';

// Import the Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB_D3x8om6jv9ukP99Si7MFaEKQE5Sdz90",
  authDomain: "hotelistan-final-zeynep.firebaseapp.com",
  databaseURL: "https://hotelistan-final-zeynep-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "hotelistan-final-zeynep",
  storageBucket: "hotelistan-final-zeynep.firebasestorage.app",
  messagingSenderId: "521763625681",
  appId: "1:521763625681:web:0d45da18f037beca3383f0"
};

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

export { 
  collection, doc, onSnapshot, setDoc, updateDoc, getDoc, getDocs, query, where, orderBy, Timestamp,
  signInWithPopup, onAuthStateChanged, signInAnonymously, addDoc, deleteDoc, writeBatch
};
export type { FirebaseUser };
