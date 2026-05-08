// Firebase se carga desde CDN en index.html (scripts compat)
// No se usan imports de npm porque esta app es vanilla JS sin bundler

const firebaseConfig = {
  apiKey: "AIzaSyBrt-lsn4YGyKXdaaqDC1utgdoHEli5wIo",
  authDomain: "misclases-84d06.firebaseapp.com",
  projectId: "misclases-84d06",
  storageBucket: "misclases-84d06.firebasestorage.app",
  messagingSenderId: "189834105052",
  appId: "1:189834105052:web:45db40a4f67a54108c2419",
  measurementId: "G-BG7V4JYVJN"
};

firebase.initializeApp(firebaseConfig);

// Servicios disponibles globalmente para app.js
window.db   = firebase.firestore();
window.auth = firebase.auth();
// Storage no disponible en plan gratuito con esta región — se usa WhatsApp para entregas
