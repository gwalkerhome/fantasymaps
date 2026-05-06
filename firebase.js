// firebase.js - library postmaster
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseconfig = {
  apiKey: "AIzaSyB6gyW7XQSE9ROpQEgvMd9hGUOM3cC6-q0",
  authDomain: "fantasymaps-20fc7.firebaseapp.com",
  projectId: "fantasymaps-20fc7",
  storageBucket: "fantasymaps-20fc7.firebasestorage.app",
  messagingSenderId: "922857136375",
  appId: "1:922857136375:web:e01e043aae36d6be98b3f2"
};

// initialize firebase
const app = initializeApp(firebaseconfig);
const db = getFirestore(app);

// utility to save data to a specific book
export async function savetolibrary(bookid, data) {
    try {
        await setDoc(doc(db, "library", bookid), data, { merge: true });
        console.log(`synced: ${bookid}`);
    } catch (e) {
        console.error("sync error: ", e);
    }
}

// utility to fetch all books in the collection
export async function fetchlibrary() {
    try {
        const querysnapshot = await getDocs(collection(db, "library"));
        return querysnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("fetch error: ", e);
        return [];
    }
}

export { db };
