import { defaultSettings, firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const termLabels = {
  nextYearFirst: "下一學年度上學期",
  sameYearSecond: "本學年度下學期"
};

const maxFirestorePdfBytes = 650 * 1024;

let app;
let auth;
let db;
let adminCreatorApp;
let adminCreatorAuth;

function isConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function ensureFirebase() {
  if (!isConfigured()) {
    throw new Error("尚未設定 Firebase，請先確認 firebase-config.js。");
  }

  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }

  return { auth, db };
}

function ensureAdminCreatorAuth() {
  if (!adminCreatorApp) {
    adminCreatorApp = initializeApp(firebaseConfig, "admin-user-creator");
    adminCreatorAuth = getAuth(adminCreatorApp);
  }
  return adminCreatorAuth;
}

function normalizeSettings(settings = {}) {
  const registrationTerm = settings.registrationTerm || defaultSettings.registrationTerm;
  const schoolYear = String(settings.schoolYear || defaultSettings.schoolYear).trim() || defaultSettings.schoolYear;
  const semester = settings.semester || defaultSettings.semester;
  return {
    ...defaultSettings,
    ...settings,
    registrationTerm,
    registrationTermLabel: termLabels[registrationTerm] || defaultSettings.registrationTermLabel,
    schoolYear,
    semester,
    registrationDisplayName: `${schoolYear}學年${semester}`
  };
}

function timestampText(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString("zh-TW", { hour12: false });
  }
  return String(value);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error || new Error("簡章讀取失敗。")));
    reader.readAsDataURL(file);
  });
}

function normalizeLookupName(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeLookupPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

async function registrationLookupKey(studentName, parentPhone) {
  const normalized = `${normalizeLookupName(studentName)}|${normalizeLookupPhone(parentPhone)}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadSettings() {
  if (!isConfigured()) return normalizeSettings();

  const { db } = ensureFirebase();
  const snap = await getDoc(doc(db, "settings", "app"));
  if (!snap.exists()) return normalizeSettings();
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
  const settingsRef = doc(db, "settings", "app");
  const snap = await getDoc(settingsRef);
  const current = snap.exists() ? snap.data() : defaultSettings;
  const clean = normalizeSettings({ ...current, ...settings });
  await setDoc(settingsRef, clean, { merge: true });
  return clean;
}

export async function listAdminAccounts() {
  const { db } = ensureFirebase();
  const snap = await getDocs(query(collection(db, "adminUsers"), orderBy("createdAt", "asc")));
  const items = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  if (!items.some((item) => item.email === "k79204@gmail.com" || item.id === "k79204@gmail.com")) {
    items.unshift({
      id: "k79204@gmail.com",
      email: "k79204@gmail.com",
      builtin: true
    });
  }
  return items;
}

export async function createAdminAccount(email, password) {
  const { db } = ensureFirebase();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("請輸入 Email。");
  if (!password || password.length < 6) throw new Error("密碼至少需要 6 個字元。");

  const secondaryAuth = ensureAdminCreatorAuth();
  try {
    await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
  } catch (error) {
    if (error.code !== "auth/email-already-in-use") throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  await setDoc(doc(db, "adminUsers", cleanEmail), {
    email: cleanEmail,
    createdAt: serverTimestamp()
  }, { merge: true });
  return { email: cleanEmail };
}

export async function removeAdminAccess(email) {
  const { db } = ensureFirebase();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanEmail === "k79204@gmail.com") {
    throw new Error("主要管理員帳號不可移除。");
  }
  await deleteDoc(doc(db, "adminUsers", cleanEmail));
}

export async function createRegistration(payload) {
  const { db } = ensureFirebase();
  const submittedAt = serverTimestamp();
  const registrationRef = doc(collection(db, "registrations"));
  const lookupKey = await registrationLookupKey(payload.studentName, payload.parentPhone);
  const lookupRef = doc(db, "registrationLookups", lookupKey, "entries", registrationRef.id);
  const batch = writeBatch(db);

  batch.set(registrationRef, {
    ...payload,
    lookupKey,
    submittedAt
  });
  batch.set(lookupRef, {
    registrationId: registrationRef.id,
    studentName: payload.studentName,
    className: payload.className,
    registrationTerm: payload.registrationTerm,
    currentGrade: payload.currentGrade,
    enrollmentGrade: payload.enrollmentGrade,
    enrollmentBand: payload.enrollmentBand,
    submittedAt
  });
  await batch.commit();

  return {
    id: registrationRef.id,
    submitted_at: new Date().toLocaleString("zh-TW", { hour12: false })
  };
}

function lookupPayloadForRegistration(id, data, submittedAt) {
  return {
    registrationId: id,
    studentName: data.studentName || "",
    className: data.className || "",
    registrationTerm: data.registrationTerm || "",
    currentGrade: data.currentGrade || "",
    enrollmentGrade: data.enrollmentGrade || "",
    enrollmentBand: data.enrollmentBand || "",
    submittedAt
  };
}

async function lookupKeyForExisting(data) {
  if (data.lookupKey) return data.lookupKey;
  if (!data.studentName || !data.parentPhone) return "";
  return registrationLookupKey(data.studentName, data.parentPhone);
}

export async function updateRegistration(id, updates) {
  const { db } = ensureFirebase();
  const registrationRef = doc(db, "registrations", id);
  const snap = await getDoc(registrationRef);
  if (!snap.exists()) throw new Error("找不到這筆報名資料。");

  const current = snap.data();
  const next = { ...current, ...updates };
  const oldLookupKey = await lookupKeyForExisting(current);
  const newLookupKey = await registrationLookupKey(next.studentName, next.parentPhone);
  const submittedAt = current.submittedAt || serverTimestamp();
  const batch = writeBatch(db);

  batch.update(registrationRef, {
    ...updates,
    lookupKey: newLookupKey,
    updatedAt: serverTimestamp()
  });

  if (oldLookupKey) {
    batch.delete(doc(db, "registrationLookups", oldLookupKey, "entries", id));
  }
  batch.set(
    doc(db, "registrationLookups", newLookupKey, "entries", id),
    lookupPayloadForRegistration(id, next, submittedAt)
  );

  await batch.commit();
}

export async function deleteRegistration(id) {
  const { db } = ensureFirebase();
  const registrationRef = doc(db, "registrations", id);
  const snap = await getDoc(registrationRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const lookupKey = await lookupKeyForExisting(data);
  const batch = writeBatch(db);
  batch.delete(registrationRef);
  if (lookupKey) {
    batch.delete(doc(db, "registrationLookups", lookupKey, "entries", id));
  }
  await batch.commit();
}

export async function findRegistrationStatus(studentName, parentPhone) {
  const { db } = ensureFirebase();
  const lookupKey = await registrationLookupKey(studentName, parentPhone);
  const lookupQuery = query(
    collection(db, "registrationLookups", lookupKey, "entries"),
    orderBy("submittedAt", "desc"),
    limit(5)
  );
  const snap = await getDocs(lookupQuery);
  return snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      submitted_at: timestampText(data.submittedAt),
      ...data
    };
  });
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
    if (item.enrollmentBand) {
      byBandMap.set(item.enrollmentBand, (byBandMap.get(item.enrollmentBand) || 0) + 1);
    }
    if (item.lunch) {
      byLunchMap.set(item.lunch, (byLunchMap.get(item.lunch) || 0) + 1);
    }
  });

  return {
    total: items.length,
    extended: items.filter((item) => item.extended === "是").length,
    byBand: [...byBandMap].map(([enrollmentBand, count]) => ({ enrollmentBand, count })),
    byLunch: [...byLunchMap].map(([lunch, count]) => ({ lunch, count }))
  };
}

export async function uploadBrochure(file) {
  if (!file || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) {
    throw new Error("請上傳 PDF 檔案。");
  }

  if (file.size > maxFirestorePdfBytes) {
    throw new Error("PDF 檔案超過 650 KB。若簡章較大，請改用 Google Drive 分享連結或啟用 Firebase Storage。");
  }

  const dataUrl = await fileToDataUrl(file);
  return saveSettings({
    brochurePath: dataUrl,
    brochureName: file.name
  });
}
