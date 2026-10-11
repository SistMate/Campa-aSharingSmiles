
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDxfnvYfHtdNZf4USmMnb7oobvp5YQJD8k",
  authDomain: "sharingsmiles-6c672.firebaseapp.com",
  projectId: "sharingsmiles-6c672",
  storageBucket: "sharingsmiles-6c672.firebasestorage.app",
  messagingSenderId: "437061943296",
  appId: "1:437061943296:web:70cd950eb0d7e7da0758e5"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Conectar con Firestore
const db = getFirestore(app);

export { app, db };
