// firebase.js - library postmaster v1.2
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

/**
 * Saves a book into the hierarchical structure.
 * Path: users -> author -> series -> book
 */
export async function savetolibrary(metadata, bookData) {
    try {
        const { userid, author, series, bookid } = metadata;
        
        // Construct the nested document reference
        const bookRef = doc(db, 
            "users", userid, 
            "authors", author, 
            "series", series, 
            "books", bookid
        );

        await setDoc(bookRef, bookData, { merge: true });
        console.log(`synced to vault: ${series} - ${bookid}`);
    } catch (e) {
        console.error("hierarchy sync error: ", e);
    }
}

// Utility to upload files remains similar but path-aware
export async function uploadartifact(path, file) {
    try {
        const storageref = ref(storage, path);
        await uploadBytes(storageref, file);
        return await getDownloadURL(storageref);
    } catch (e) {
        console.error("upload error: ", e);
        return null;
    }
}

// Note: fetchlibrary will now need a specific path or collectionGroup query 
// to pull books for a specific series.
export async function fetchseriesbooks(userid, author, series) {
    try {
        const colPath = collection(db, "users", userid, "authors", author, "series", series, "books");
        const querysnapshot = await getDocs(colPath);
        return querysnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("fetch error: ", e);
        return [];
    }
}

export { db, storage };
