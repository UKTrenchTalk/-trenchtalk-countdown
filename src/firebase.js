import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBcTdz7PUBuVrb4t0CZixpokonov9bgemY",
  authDomain: "trenchtalk-fcd4f.firebaseapp.com",
  projectId: "trenchtalk-fcd4f",
  storageBucket: "trenchtalk-fcd4f.firebasestorage.app",
  messagingSenderId: "979427895601",
  appId: "1:979427895601:web:fc307c281e2bbc60d12810",
  measurementId: "G-KF1PN3X0RS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();