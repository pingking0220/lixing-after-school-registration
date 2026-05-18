import {
  buildStats,
  listRegistrations,
  loadSettings,
  saveSettings,
  signInAdmin,
  signOutAdmin,
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
let registrations = [];
let hasLoadedAdmin = false;

function showAdmin() {
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
  row.append(cell);
}

function renderRows() {
  const keyword = searchBox.value.trim();
  const filtered = registrations.filter((item) => matchRow(item, keyword));

  if (!filtered.length) {
    rowsBody.innerHTML = '<tr><td colspan="10">目前沒有符合條件的報名資料</td></tr>';
    return;
  }

  rowsBody.replaceChildren(
    ...filtered.map((item) => {
      const row = document.createElement("tr");
      appendCell(row, item.id);
      appendCell(row, item.submitted_at);
      appendCell(row, `${item.studentName}\n${item.gender}`);
      appendCell(row, item.className);
      appendCell(row, `${item.enrollmentGrade}\n${item.enrollmentBand}`);
      appendCell(row, `${item.care}\n${Array.isArray(item.careDays) ? item.careDays.join("、") : item.careDays || ""}`);
      appendCell(row, `${item.extended}\n${Array.isArray(item.extendedDays) ? item.extendedDays.join("、") : item.extendedDays || ""}`);
      appendCell(row, item.lunch);
      appendCell(row, `${item.subsidy}\n${Array.isArray(item.subsidyTypes) ? item.subsidyTypes.join("、") : item.subsidyTypes || ""}`);
      appendCell(row, `${item.parentName}\n${item.parentPhone}\n${item.email}`);
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

function csvValue(value) {
  const text = Array.isArray(value) ? value.join("、") : String(value || "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const headers = [
    "編號",
    "送出時間",
    "學生姓名",
    "性別",
    "班級",
    "家長姓名",
    "家長手機",
    "Email",
    "報名學期",
    "目前年級",
    "報名時年級",
    "報名時年段",
    "課後照顧班",
    "課後照顧班日期",
    "延長班",
    "延長班日期",
    "午餐",
    "減免身分",
    "減免身分別",
    "備註"
  ];
  const rows = registrations.map((item) => [
    item.id,
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

  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "課後照顧班報名資料.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadAdmin() {
  const [items, settings] = await Promise.all([listRegistrations(), loadSettings()]);
  registrations = items;

  settingsForm.querySelector('[name="registrationTerm"]').value = settings.registrationTerm;
  currentBrochureLink.href = settings.brochurePath || "#";
  currentBrochureLink.textContent = settings.brochureName || "尚未設定";
  renderStats();
  renderRows();
}

searchBox.addEventListener("input", renderRows);
exportCsvButton.addEventListener("click", exportCsv);

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  settingsMessage.textContent = "儲存中";

  try {
    const result = await saveSettings({
      registrationTerm: settingsForm.querySelector('[name="registrationTerm"]').value
    });
    settingsMessage.textContent = `已設定為：${result.registrationTermLabel}`;
  } catch (error) {
    settingsMessage.textContent = `設定未儲存：${error.message}`;
  }
});

brochureForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  brochureMessage.textContent = "上傳中";

  try {
    const file = brochureForm.querySelector('[name="brochure"]').files[0];
    const result = await uploadBrochure(file);
    currentBrochureLink.href = result.brochurePath;
    currentBrochureLink.textContent = result.brochureName;
    brochureForm.reset();
    brochureMessage.textContent = "招生簡章已更新";
  } catch (error) {
    brochureMessage.textContent = `招生簡章未更新：${error.message}`;
  }
});

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "登入中";

  try {
    await signInAdmin(adminLoginForm.adminEmail.value.trim(), adminLoginForm.adminPassword.value);
    loginMessage.textContent = "";
  } catch (error) {
    loginMessage.textContent = `登入失敗：${error.message}`;
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
        rowsBody.innerHTML = `<tr><td colspan="10">後台資料載入失敗：${error.message}</td></tr>`;
      });
    }
  });
} catch (error) {
  loginMessage.textContent = error.message;
  showLogin();
}
