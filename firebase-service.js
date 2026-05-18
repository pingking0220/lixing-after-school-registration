import { firebaseConfig, defaultSettings } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const termLabels = {
  nextYearFirst: "下一學年度上學期",
  sameYearSecond: "同學年度下學期"
};

function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let app;
let auth;
let db;
let storage;

function ensureFirebase() {
  if (!isConfigured()) {
    throw new Error("尚未設定 Firebase，請先填寫 firebase-config.js。");
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }

  return { auth, db, storage };
}

function normalizeSettings(settings = {}) {
  const registrationTerm = settings.registrationTerm || defaultSettings.registrationTerm;
  return {
    ...defaultSettings,
    ...settings,
    registrationTerm,
    registrationTermLabel: termLabels[registrationTerm] || defaultSettings.registrationTermLabel
  };
}

function timestampText(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString("zh-TW", { hour12: false });
  }
  return String(value);
}

export async function loadSettings() {
  if (!isConfigured()) return normalizeSettings();

  const { db } = ensureFirebase();
  const snap = await getDoc(doc(db, "settings", "app"));
  if (!snap.exists()) {
    await setDoc(doc(db, "settings", "app"), defaultSettings, { merge: true });
    return normalizeSettings();
  }
  return normalizeSettings(snap.data());
}

export async function signInAdmin(email, password) {
  const { auth } = ensureFirebase();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin() {
  const { auth } = ensureFirebase();
  return signOut(auth);
}

export function watchAdminAuth(callback) {
  const { auth } = ensureFirebase();
  return onAuthStateChanged(auth, callback);
}

export async function saveSettings(settings) {
  const { db } = ensureFirebase();
  const clean = normalizeSettings(settings);
  await setDoc(doc(db, "settings", "app"), clean, { merge: true });
  return clean;
}

export async function createRegistration(payload) {
  const { db } = ensureFirebase();
  const docRef = await addDoc(collection(db, "registrations"), {
    ...payload,
    submittedAt: serverTimestamp()
  });
  return {
    id: docRef.id,
    submitted_at: new Date().toLocaleString("zh-TW", { hour12: false })
  };
}

export async function listRegistrations() {
  const { db } = ensureFirebase();
  const registrationsQuery = query(collection(db, "registrations"), orderBy("submittedAt", "desc"));
  const snap = await getDocs(registrationsQuery);
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      submitted_at: timestampText(data.submittedAt),
      ...data
    };
  });
}

export function buildStats(items) {
  const byBandMap = new Map();
  const byLunchMap = new Map();

  items.forEach((item) => {
    byBandMap.set(item.enrollmentBand, (byBandMap.get(item.enrollmentBand) || 0) + 1);
    byLunchMap.set(item.lunch, (byLunchMap.get(item.lunch) || 0) + 1);
  });

  return {
    total: items.length,
    extended: items.filter((item) => item.extended === "是").length,
    byBand: [...byBandMap].filter(([label]) => label).map(([enrollmentBand, count]) => ({ enrollmentBand, count })),
    byLunch: [...byLunchMap].filter(([label]) => label).map(([lunch, count]) => ({ lunch, count }))
  };
}

export async function uploadBrochure(file) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("請上傳 PDF 檔案。");
  }

  const { storage } = ensureFirebase();
  const safeName = file.name.replace(/[<>:"/\\|?*]+/g, "_");
  const brochureRef = ref(storage, `brochures/${Date.now()}-${safeName}`);
  await uploadBytes(brochureRef, file, { contentType: "application/pdf" });
  const url = await getDownloadURL(brochureRef);
  const settings = await saveSettings({
    brochurePath: url,
    brochureName: file.name
  });
  return settings;
}
