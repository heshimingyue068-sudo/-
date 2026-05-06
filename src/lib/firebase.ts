import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log("Firebase initialized with project:", firebaseConfig.projectId);
console.log("Using database:", firebaseConfig.firestoreDatabaseId || "(default)");

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Validate connection
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    console.log("Firestore connection successful");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('unavailable')) {
        console.warn("Firestore is currently unavailable. It might still be provisioning or you might have a network issue.");
      } else {
        console.error("Firestore connection test failed:", error.message);
      }
    }
  }
}
testConnection();
