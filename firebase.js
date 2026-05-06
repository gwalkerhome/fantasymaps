// firebase.js - library postmaster v1.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseconfig = {
  apiKey: "AIzaSyB6gyW7XQSE9ROpQEgvMd9hGUOM3cC6-q0",
  authDomain: "fantasymaps-20fc7.firebaseapp.com",
  projectId: "fantasymaps-20fc7",
  storageBucket: "fantasymaps-20fc7.firebasestorage.app",
  messagingSenderId: "922857136375",
  appId: "1:922857136375:web:e01e043aae36d6be98b3f2"
};

const app = initializeApp(firebaseconfig);
const db = getFirestore(app);
const storage = getStorage(app);

// utility to save data to firestore
export async function savetolibrary(bookid, data) {
    try {
        await setDoc(doc(db, "library", bookid), data, { merge: true });
        console.log(`synced: ${bookid}`);
    } catch (e) {
        console.error("sync error: ", e);
    }
}

// utility to upload a file (like a cover) to storage
export async function uploadartifact(path, file) {
    try {
        const storageref = ref(storage, path);
        await uploadBytes(storageref, file);
        const url = await getDownloadURL(storageref);
        return url;
    } catch (e) {
        console.error("upload error: ", e);
        return null;
    }
}

export async function fetchlibrary() {
    try {
        const querysnapshot = await getDocs(collection(db, "library"));
        return querysnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("fetch error: ", e);
        return [];
    }
}

export { db, storage };
