// Importa la función de inicialización de Firebase
import { initializeApp } from 'firebase/app';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrt-lsn4YGyKXdaaqDC1utgdoHEli5wIo",
  authDomain: "misclases-84d06.firebaseapp.com",
  projectId: "misclases-84d06",
  storageBucket: "misclases-84d06.firebasestorage.app",
  messagingSenderId: "189834105052",
  appId: "1:189834105052:web:45db40a4f67a54108c2419",
  measurementId: "G-BG7V4JYVJN"
};

// Inicializa Firebase en tu aplicación
const app = initializeApp(firebaseConfig);

// Exporta 'app' si necesitas usarlo en otros archivos (por ejemplo, para Firestore o Auth)
export default app;