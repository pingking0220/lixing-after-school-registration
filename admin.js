import {
  buildStats,
  createAdminAccount,
  deleteRegistration,
  listAdminAccounts,
  listRegistrations,
  loadSettings,
  removeAdminAccess,
  saveSettings,
  signInAdmin,
  signOutAdmin,
  updateRegistration,
  uploadBrochure,
  watchAdminAuth
} from "./firebase-service.js";

const adminLogin = document.querySelector("#adminLogin");
const adminApp = document.querySelector("#adminApp");
const adminLoginForm = document.querySelector("#adminLoginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const rowsBody = document.querySelector("#registrationRows");
const searchBox = document.querySelector("#searchBox");
const settingsForm = document.querySelector("#settingsForm");
const settingsMessage = document.querySelector("#settingsMessage");
const brochureForm = document.querySelector("#brochureForm");
const brochureMessage = document.querySelector("#brochureMessage");
const currentBrochureLink = document.querySelector("#currentBrochureLink");
const exportCsvButton = document.querySelector("#exportCsvButton");
const adminAccountForm = document.querySelector("#adminAccountForm");
const adminAccountMessage = document.querySelector("#adminAccountMessage");
const adminAccountsList = document.querySelector("#adminAccountsList");
const editDialog = document.querySelector("#editDialog");
const editRegistrationForm = document.querySelector("#editRegistrationForm");
const closeEditButton = document.querySelector("#closeEditButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const editMessage = document.querySelector("#editMessage");

let registrations = [];
let adminAccounts = [];
let hasLoadedAdmin = false;

function friendlyError(error) {
  const code = error?.code || "";
  if (code === "auth/operation-not-allowed") {
    return "Firebase Authentication 尚未啟用 Email/Password，請先到 Firebase Console 開啟。";
  }
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "帳號或密碼不正確。";
  }
  if (code === "permission-denied") {
    return "目前帳號沒有讀寫權限，請確認已登入後台帳號。";
  }
  return error?.message || "發生未知錯誤。";
}

function showAdmin() {
  adminLoginForm.reset();
  loginMessage.textContent = "";
  adminLogin.hidden = true;
  adminApp.hidden = false;
}

function showLogin() {
  adminLogin.hidden = false;
  adminApp.hidden = true;
}

function summarize(items, keyName, valueName = "count") {
  if (!items.length) return "-";
  return items.map((item) => `${item[keyName]} ${item[valueName]}`).join("、");
}

function matchRow(item, keyword) {
  if (!keyword) return true;
  const haystack = [
    item.studentName,
    item.className,
    item.parentName,
    item.parentPhone,
    item.email,
    item.enrollmentBand
  ].join(" ").toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

function appendCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text || "";
  cell.style.whiteSpace = "pre-line";
  row.append(cell);
}

function arrayText(value) {
  return Array.isArray(value) ? value.join("、") : value || "";
}

function textToArray(value) {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentItem(id) {
  return registrations.find((item) => item.id === id);
}

function setField(name, value) {
  editRegistrationForm.querySelector(`[name="${name}"]`).value = value || "";
}

function formValue(name) {
  return editRegistrationForm.querySelector(`[name="${name}"]`).value.trim();
}

function openEditDialog(item) {
  editRegistrationForm.dataset.registrationId = item.id;
  editMessage.textContent = "";
  setField("studentName", item.studentName);
  setField("gender", item.gender);
  setField("className", item.className);
  setField("parentName", item.parentName);
  setField("parentPhone", item.parentPhone);
  setField("email", item.email);
  setField("registrationTerm", item.registrationTerm);
  setField("currentGrade", item.currentGrade);
  setField("enrollmentGrade", item.enrollmentGrade);
  setField("enrollmentBand", item.enrollmentBand);
  setField("care", item.care);
  setField("careDays", arrayText(item.careDays));
  setField("extended", item.extended);
  setField("extendedDays", arrayText(item.extendedDays));
  setField("lunch", item.lunch);
  setField("subsidy", item.subsidy);
  setField("subsidyTypes", arrayText(item.subsidyTypes));
  setField("notes", item.notes);
  editDialog.hidden = false;
  editRegistrationForm.studentName.focus();
}

function closeEditDialog() {
  editDialog.hidden = true;
  editRegistrationForm.reset();
  editRegistrationForm.removeAttribute("data-registration-id");
}

function appendActions(row, item) {
  const cell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editButton = document.createElement("button");
  editButton.className = "ghost-link small-action";
  editButton.type = "button";
  editButton.textContent = "編輯";
  editButton.addEventListener("click", () => openEditDialog(item));

  const deleteButton = document.createElement("button");
  deleteButton.className = "ghost-link danger-action small-action";
  deleteButton.type = "button";
  deleteButton.textContent = "刪除";
  deleteButton.addEventListener("click", async () => {
    const ok = window.confirm(`確定要刪除「${item.studentName || "這筆"}」的報名資料嗎？刪除後家長查詢也會查不到。`);
    if (!ok) return;
    deleteButton.disabled = true;
    try {
      await deleteRegistration(item.id);
      await loadAdmin();
    } catch (error) {
      window.alert(`刪除失敗：${friendlyError(error)}`);
      deleteButton.disabled = false;
    }
  });

  actions.append(editButton, deleteButton);
  cell.append(actions);
  row.append(cell);
}

function renderRows() {
  const keyword = searchBox.value.trim();
  const filtered = registrations.filter((item) => matchRow(item, keyword));

  if (!filtered.length) {
    rowsBody.innerHTML = '<tr><td colspan="10">目前沒有符合條件的報名資料。</td></tr>';
    return;
  }

  rowsBody.replaceChildren(
    ...filtered.map((item) => {
      const row = document.createElement("tr");
      appendCell(row, item.submitted_at);
      appendCell(row, `${item.studentName || ""}\n${item.gender || ""}`);
      appendCell(row, item.className);
      appendCell(row, `${item.enrollmentGrade || ""}\n${item.enrollmentBand || ""}`);
      appendCell(row, `${item.care || ""}\n${Array.isArray(item.careDays) ? item.careDays.join("、") : item.careDays || ""}`);
      appendCell(row, `${item.extended || ""}\n${Array.isArray(item.extendedDays) ? item.extendedDays.join("、") : item.extendedDays || ""}`);
      appendCell(row, item.lunch);
      appendCell(row, `${item.subsidy || ""}\n${Array.isArray(item.subsidyTypes) ? item.subsidyTypes.join("、") : item.subsidyTypes || ""}`);
      appendCell(row, `${item.parentName || ""}\n${item.parentPhone || ""}\n${item.email || ""}`);
      appendActions(row, item);
      return row;
    })
  );
}

function renderStats() {
  const stats = buildStats(registrations);
  document.querySelector("#totalCount").textContent = stats.total;
  document.querySelector("#extendedCount").textContent = stats.extended;
  document.querySelector("#bandSummary").textContent = summarize(stats.byBand, "enrollmentBand");
  document.querySelector("#lunchSummary").textContent = summarize(stats.byLunch, "lunch");
}

function renderAdminAccounts() {
  if (!adminAccounts.length) {
    adminAccountsList.textContent = "尚未載入管理員清單。";
    return;
  }

  adminAccountsList.replaceChildren(
    ...adminAccounts.map((account) => {
      const email = account.email || account.id;
      const item = document.createElement("div");
      item.className = "admin-account-row";

      const label = document.createElement("span");
      label.textContent = email;

      const badge = document.createElement("small");
      badge.textContent = email === "k79204@gmail.com" ? "主要管理員" : "可登入後台";

      item.append(label, badge);

      if (email !== "k79204@gmail.com") {
        const removeButton = document.createElement("button");
        removeButton.className = "ghost-link danger-action small-action";
        removeButton.type = "button";
        removeButton.textContent = "移除權限";
        removeButton.addEventListener("click", async () => {
          const ok = window.confirm(`確定要移除 ${email} 的後台權限嗎？`);
          if (!ok) return;
          removeButton.disabled = true;
          try {
            await removeAdminAccess(email);
            await loadAdminAccounts();
          } catch (error) {
            window.alert(`移除失敗：${friendlyError(error)}`);
            removeButton.disabled = false;
          }
        });
        item.append(removeButton);
      }

      return item;
    })
  );
}

async function loadAdminAccounts() {
  adminAccounts = await listAdminAccounts();
  renderAdminAccounts();
}

function csvValue(value) {
  const text = Array.isArray(value) ? value.join("、") : String(value || "");
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeYear(value) {
  return value.trim().replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function dateInputValue(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateFromInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("請確認開放與關閉報名時間格式。");
  return date;
}

function exportCsv() {
  const headers = [
    "送出時間",
    "學生姓名",
    "性別",
    "班級",
    "家長姓名",
    "家長電話",
    "Email",
    "報名學期",
    "目前年級",
    "報名年級",
    "報名年段",
    "課後照顧",
    "課後照顧日數",
    "延長照顧",
    "延長照顧日數",
    "午餐",
    "補助",
    "補助身分",
    "備註"
  ];
  const rows = registrations.map((item) => [
    item.submitted_at,
    item.studentName,
    item.gender,
    item.className,
    item.parentName,
    item.parentPhone,
    item.email,
    item.registrationTerm,
    item.currentGrade,
    item.enrollmentGrade,
    item.enrollmentBand,
    item.care,
    item.careDays,
    item.extended,
    item.extendedDays,
    item.lunch,
    item.subsidy,
    item.subsidyTypes,
    item.notes
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "課後照顧班報名資料.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function updateBrochureLink(settings) {
  if (!settings.brochurePath) {
    currentBrochureLink.removeAttribute("href");
    currentBrochureLink.textContent = "尚未設定";
    return;
  }

  currentBrochureLink.href = settings.brochurePath;
  currentBrochureLink.textContent = settings.brochureName || "開啟目前簡章";
}

async function loadAdmin() {
  const [items, settings, accounts] = await Promise.all([listRegistrations(), loadSettings(), listAdminAccounts()]);
  registrations = items;
  adminAccounts = accounts;

  settingsForm.querySelector('[name="schoolYear"]').value = settings.schoolYear;
  settingsForm.querySelector('[name="semester"]').value = settings.semester;
  settingsForm.querySelector('[name="registrationTerm"]').value = settings.registrationTerm;
  settingsForm.querySelector('[name="registrationOpenAt"]').value = dateInputValue(settings.registrationOpenAt);
  settingsForm.querySelector('[name="registrationCloseAt"]').value = dateInputValue(settings.registrationCloseAt);
  updateBrochureLink(settings);
  renderAdminAccounts();
  renderStats();
  renderRows();
}

searchBox.addEventListener("input", renderRows);
exportCsvButton.addEventListener("click", exportCsv);
closeEditButton.addEventListener("click", closeEditDialog);
cancelEditButton.addEventListener("click", closeEditDialog);

editDialog.addEventListener("click", (event) => {
  if (event.target === editDialog) closeEditDialog();
});

editRegistrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = editRegistrationForm.dataset.registrationId;
  if (!currentItem(id)) return;

  editMessage.textContent = "儲存中";
  try {
    await updateRegistration(id, {
      studentName: formValue("studentName"),
      gender: formValue("gender"),
      className: formValue("className"),
      parentName: formValue("parentName"),
      parentPhone: formValue("parentPhone"),
      email: formValue("email"),
      registrationTerm: formValue("registrationTerm"),
      currentGrade: formValue("currentGrade"),
      enrollmentGrade: formValue("enrollmentGrade"),
      enrollmentBand: formValue("enrollmentBand"),
      care: formValue("care"),
      careDays: textToArray(formValue("careDays")),
      extended: formValue("extended"),
      extendedDays: textToArray(formValue("extendedDays")),
      lunch: formValue("lunch"),
      subsidy: formValue("subsidy"),
      subsidyTypes: textToArray(formValue("subsidyTypes")),
      notes: formValue("notes")
    });
    await loadAdmin();
    closeEditDialog();
  } catch (error) {
    editMessage.textContent = `儲存失敗：${friendlyError(error)}`;
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsMessage.textContent = "儲存中";

  try {
    const schoolYear = normalizeYear(settingsForm.querySelector('[name="schoolYear"]').value);
    if (!schoolYear) throw new Error("請填寫學年。");
    const registrationOpenAt = dateFromInput(settingsForm.querySelector('[name="registrationOpenAt"]').value);
    const registrationCloseAt = dateFromInput(settingsForm.querySelector('[name="registrationCloseAt"]').value);
    if (registrationOpenAt && registrationCloseAt && registrationCloseAt <= registrationOpenAt) {
      throw new Error("關閉報名時間必須晚於開放報名時間。");
    }

    const result = await saveSettings({
      schoolYear,
      semester: settingsForm.querySelector('[name="semester"]').value,
      registrationTerm: settingsForm.querySelector('[name="registrationTerm"]').value,
      registrationOpenAt,
      registrationCloseAt
    });
    settingsMessage.textContent = `已儲存：${result.registrationDisplayName}（${result.registrationTermLabel}）`;
  } catch (error) {
    settingsMessage.textContent = `設定儲存失敗：${friendlyError(error)}`;
  }
});

brochureForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  brochureMessage.textContent = "上傳中";

  try {
    const file = brochureForm.querySelector('[name="brochure"]').files[0];
    const result = await uploadBrochure(file);
    updateBrochureLink(result);
    brochureForm.reset();
    brochureMessage.textContent = "招生簡章已更新。";
  } catch (error) {
    brochureMessage.textContent = `招生簡章更新失敗：${friendlyError(error)}`;
  }
});

adminAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminAccountMessage.textContent = "新增中";

  try {
    const email = adminAccountForm.adminAccountEmail.value.trim();
    const password = adminAccountForm.adminAccountPassword.value;
    const result = await createAdminAccount(email, password);
    adminAccountForm.reset();
    adminAccountMessage.textContent = `已新增後台帳號：${result.email}`;
    await loadAdminAccounts();
  } catch (error) {
    adminAccountMessage.textContent = `新增失敗：${friendlyError(error)}`;
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "登入中";

  try {
    await signInAdmin(adminLoginForm.adminEmail.value.trim(), adminLoginForm.adminPassword.value);
    loginMessage.textContent = "";
  } catch (error) {
    loginMessage.textContent = `登入失敗：${friendlyError(error)}`;
  }
});

logoutButton.addEventListener("click", async () => {
  await signOutAdmin();
});

try {
  watchAdminAuth((user) => {
    if (!user) {
      hasLoadedAdmin = false;
      showLogin();
      return;
    }

    showAdmin();
    if (!hasLoadedAdmin) {
      hasLoadedAdmin = true;
      loadAdmin().catch((error) => {
        rowsBody.innerHTML = `<tr><td colspan="10">後台資料載入失敗：${friendlyError(error)}</td></tr>`;
      });
    }
  });
} catch (error) {
  loginMessage.textContent = friendlyError(error);
  showLogin();
}
