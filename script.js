import { createRegistration, loadSettings as loadRemoteSettings } from "./firebase-service.js";

const form = document.querySelector("#registrationForm");
const gradePlaceholder = document.querySelector("#gradePlaceholder");
const gradePanels = [...document.querySelectorAll(".grade-panel")];
const summaryContent = document.querySelector("#summaryContent");
const extendedDays = document.querySelector("#extendedDays");
const subsidyTypes = document.querySelector("#subsidyTypes");
const gradeResult = document.querySelector("#gradeResult");
const brochureLink = document.querySelector("#brochureLink");
const brochureName = document.querySelector("#brochureName");
const brochureNote = document.querySelector("#brochureNote");
const confirmRules = document.querySelector('[name="confirmRules"]');
const classHint = document.querySelector("#classHint");
const resetButton = document.querySelector("#resetButton");
const editButton = document.querySelector("#editButton");
const submitButton = document.querySelector("#submitButton");
const confirmSubmitButton = document.querySelector("#confirmSubmitButton");

let appSettings = {
  registrationTerm: "nextYearFirst",
  registrationTermLabel: "下一學年度上學期",
  schoolYear: "115",
  semester: "上學期",
  registrationDisplayName: "115學年上學期",
  brochurePath: "brochures/115-1課後照顧班招生簡章(二到六年級).pdf",
  brochureName: "115-1課後照顧班招生簡章(二到六年級).pdf"
};
let keepSummaryAfterReset = false;
let pendingPayload = null;

const gradeKey = {
  低年級: "low",
  中年級: "mid",
  高年級: "high"
};

const gradeNames = {
  1: "一年級",
  2: "二年級",
  3: "三年級",
  4: "四年級",
  5: "五年級",
  6: "六年級",
  7: "七年級"
};

const chineseGrades = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  壹: 1,
  貳: 2,
  參: 3,
  肆: 4,
  伍: 5,
  陸: 6
};

function checkedValue(name) {
  return form.querySelector(`[name="${name}"]:checked`)?.value || "";
}

function checkedValues(name) {
  return [...form.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
}

function fieldValue(name) {
  return form.querySelector(`[name="${name}"]`)?.value.trim() || "";
}

function toHalfWidthDigits(value) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function parseGradeFromClassName(value) {
  const text = toHalfWidthDigits(value).trim().replace(/\s+/g, "");
  if (!text) return 0;

  const threeDigitClassCode = text.match(/^([1-6])\d{2}$/);
  if (threeDigitClassCode) return Number(threeDigitClassCode[1]);

  const digitBeforeGrade = text.match(/^([1-6])(?:年級|年)/);
  if (digitBeforeGrade) return Number(digitBeforeGrade[1]);

  const chineseBeforeGrade = text.match(/^([一二三四五六壹貳參肆伍陸])(?:年級|年)/);
  if (chineseBeforeGrade) return chineseGrades[chineseBeforeGrade[1]] || 0;

  const looseChinese = text.match(/^([一二三四五六壹貳參肆伍陸])(?=[班0-9一二三四五六壹貳參肆伍陸])/);
  if (looseChinese) return chineseGrades[looseChinese[1]] || 0;

  return 0;
}

function updateGradeFromClassName() {
  const grade = parseGradeFromClassName(fieldValue("className"));
  const currentGrade = form.querySelector('[name="currentGrade"]');

  if (!fieldValue("className")) {
    currentGrade.value = "";
    classHint.textContent = "可輸入中文班級或數字班級，例如二年三班、2 年 3 班、203。";
    updateGradePanel();
    updateConditionalGroups();
    return;
  }

  if (grade) {
    currentGrade.value = String(grade);
    classHint.textContent = `系統已判讀目前年級：${gradeNames[grade]}。`;
  } else {
    currentGrade.value = "";
    classHint.textContent = "無法判讀目前年級，請輸入例如二年三班、2 年 3 班或 203。";
  }

  updateGradePanel();
  updateConditionalGroups();
}

function setGroupEnabled(container, enabled) {
  container.classList.toggle("is-muted", !enabled);
  container.querySelectorAll("input").forEach((input) => {
    input.disabled = !enabled;
    if (!enabled) input.checked = false;
  });
}

function setFieldsLocked(locked) {
  form.querySelectorAll("input, select, textarea").forEach((control) => {
    if (control.type !== "hidden") control.disabled = locked;
  });

  if (!locked) {
    updateGradePanel();
    updateConditionalGroups();
    if (brochureLink.getAttribute("href") && confirmRules.checked) {
      confirmRules.disabled = false;
    }
  }
}

function setConfirmationMode(enabled) {
  resetButton.hidden = enabled;
  submitButton.hidden = enabled;
  editButton.hidden = !enabled;
  confirmSubmitButton.hidden = !enabled;
  setFieldsLocked(enabled);
}

function updateBrochure(settings) {
  const path = settings.brochurePath || "";
  const name = settings.brochureName || "尚未設定簡章";
  brochureName.textContent = name;

  if (!path) {
    brochureLink.removeAttribute("href");
    brochureNote.textContent = "後台尚未設定簡章，請先通知學校承辦人員。";
    confirmRules.disabled = true;
    confirmRules.checked = false;
    return;
  }

  brochureLink.href = path;
  brochureNote.textContent = "請點選「另開簡章」閱讀後，再回到本頁勾選確認。";
  confirmRules.disabled = true;
  confirmRules.checked = false;
}

function getEnrollmentGradeNumber() {
  const currentGrade = Number(fieldValue("currentGrade"));
  if (!currentGrade) return 0;
  return appSettings.registrationTerm === "nextYearFirst" ? currentGrade + 1 : currentGrade;
}

function bandFromGrade(gradeNumber) {
  if (gradeNumber >= 1 && gradeNumber <= 2) return "低年級";
  if (gradeNumber >= 3 && gradeNumber <= 4) return "中年級";
  if (gradeNumber >= 5 && gradeNumber <= 6) return "高年級";
  return "";
}

function getEnrollmentGrade() {
  const gradeNumber = getEnrollmentGradeNumber();
  return {
    number: gradeNumber,
    name: gradeNames[gradeNumber] || "",
    band: bandFromGrade(gradeNumber)
  };
}

function updateGradePanel() {
  const enrollment = getEnrollmentGrade();
  const grade = enrollment.band;
  gradePlaceholder.hidden = Boolean(grade) || enrollment.number > 6;
  gradeResult.classList.toggle("is-warning", enrollment.number > 6);

  if (!fieldValue("currentGrade")) {
    gradeResult.textContent = "請先輸入目前班級，系統會自動判斷報名年級與年段。";
  } else if (enrollment.number > 6) {
    gradeResult.textContent = "依目前設定，學生升上七年級，已不適用本次國小課後照顧班報名。";
  } else {
    gradeResult.textContent = `報名學期：${appSettings.registrationDisplayName}。本次以 ${enrollment.name}、${enrollment.band} 身分報名。`;
  }

  gradePanels.forEach((panel) => {
    const active = panel.dataset.grade === grade;
    panel.hidden = !active;
    panel.querySelectorAll("input").forEach((input) => {
      input.disabled = !active;
      if (!active) input.checked = false;
    });
  });
}

function updateConditionalGroups() {
  const grade = getEnrollmentGrade().band;
  const key = gradeKey[grade];

  gradePanels.forEach((panel) => {
    const field = panel.querySelector("[data-days-for]");
    if (!field || panel.hidden) return;
    const careName = field.dataset.daysFor;
    setGroupEnabled(field, checkedValue(careName) === "是");
  });

  setGroupEnabled(extendedDays, checkedValue("extended") === "是");
  setGroupEnabled(subsidyTypes, checkedValue("subsidy") === "符合補助身分");

  if (!key) return;
}

function validateGroupedChoices() {
  form.querySelectorAll(".error-message").forEach((item) => item.remove());

  const messages = [];
  const enrollment = getEnrollmentGrade();
  const grade = enrollment.band;
  const key = gradeKey[grade];

  if (confirmRules.disabled || !confirmRules.checked) {
    messages.push("請先另開並閱讀招生簡章，再勾選家長確認。");
  }

  if (!fieldValue("currentGrade")) {
    messages.push("請輸入可判讀年級的班級，例如二年三班或 203。");
  }

  if (enrollment.number > 6) {
    messages.push("本次報名年級已超過國小六年級，無法送出報名。");
  }

  if (key && checkedValue(`care_${key}`) === "是" && checkedValues(`careDays_${key}`).length === 0) {
    messages.push("請至少選擇一個課後照顧班報名日。");
  }

  if (checkedValue("extended") === "是" && checkedValues("extendedDays").length === 0) {
    messages.push("請至少選擇一個延長照顧報名日。");
  }

  if (checkedValue("subsidy") === "符合補助身分" && checkedValues("subsidyTypes").length === 0) {
    messages.push("請至少選擇一項補助身分。");
  }

  if (messages.length > 0) {
    const error = document.createElement("p");
    error.className = "error-message";
    error.textContent = messages.join(" ");
    form.querySelector(".form-actions").prepend(error);
    return false;
  }

  return true;
}

function addSummaryRow(list, label, value) {
  const row = document.createElement("div");
  row.className = "row";

  const term = document.createElement("dt");
  term.textContent = label;

  const detail = document.createElement("dd");
  detail.textContent = value || "未填寫";

  row.append(term, detail);
  list.append(row);
}

function renderSummary(payload, submitResult = {}) {
  const list = document.createElement("dl");

  if (submitResult.id) {
    addSummaryRow(list, "報名編號", String(submitResult.id));
    addSummaryRow(list, "送出時間", submitResult.submitted_at);
  }

  addSummaryRow(list, "學生姓名", payload.studentName);
  addSummaryRow(list, "學生性別", payload.gender);
  addSummaryRow(list, "目前班級", payload.className);
  addSummaryRow(list, "家長姓名", payload.parentName);
  addSummaryRow(list, "家長電話", payload.parentPhone);
  addSummaryRow(list, "Email", payload.email);
  addSummaryRow(list, "報名學期", payload.registrationTerm);
  addSummaryRow(list, "目前年級", payload.currentGrade);
  addSummaryRow(list, "報名年級", payload.enrollmentGrade);
  addSummaryRow(list, "報名年段", payload.enrollmentBand);
  addSummaryRow(list, "課後照顧班", payload.care);
  addSummaryRow(list, "課後照顧班日數", payload.careDays.join("、"));
  addSummaryRow(list, "延長照顧", payload.extended);
  addSummaryRow(list, "延長照顧日數", payload.extendedDays.join("、"));
  addSummaryRow(list, "午餐", payload.lunch);
  addSummaryRow(list, "補助", payload.subsidy);
  addSummaryRow(list, "補助身分", payload.subsidyTypes.join("、"));
  addSummaryRow(list, "備註", payload.notes);

  summaryContent.className = "";
  summaryContent.replaceChildren(list);
}

function collectPayload() {
  const enrollment = getEnrollmentGrade();
  const key = gradeKey[enrollment.band];

  return {
    studentName: fieldValue("studentName"),
    gender: checkedValue("gender"),
    className: fieldValue("className"),
    parentName: fieldValue("parentName"),
    parentPhone: fieldValue("parentPhone"),
    email: fieldValue("email"),
    registrationTerm: appSettings.registrationDisplayName,
    currentGrade: gradeNames[Number(fieldValue("currentGrade"))] || "",
    enrollmentGrade: enrollment.name,
    enrollmentBand: enrollment.band,
    care: key ? checkedValue(`care_${key}`) : "",
    careDays: key ? checkedValues(`careDays_${key}`) : [],
    extended: checkedValue("extended"),
    extendedDays: checkedValues("extendedDays"),
    lunch: checkedValue("lunch"),
    subsidy: checkedValue("subsidy"),
    subsidyTypes: checkedValues("subsidyTypes"),
    notes: fieldValue("notes")
  };
}

form.addEventListener("change", () => {
  updateGradePanel();
  updateConditionalGroups();
});

form.querySelector('[name="className"]').addEventListener("input", updateGradeFromClassName);

form.addEventListener("reset", () => {
  pendingPayload = null;
  setConfirmationMode(false);
  const keepSummary = keepSummaryAfterReset;
  keepSummaryAfterReset = false;
  window.setTimeout(() => {
    classHint.textContent = "可輸入中文班級或數字班級，例如二年三班、2 年 3 班、203。";
    updateGradePanel();
    updateConditionalGroups();
    if (!keepSummary) {
      summaryContent.className = "summary-empty";
      summaryContent.textContent = "送出後會在這裡顯示本次報名內容。";
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateGradeFromClassName();
  updateConditionalGroups();

  if (!form.reportValidity() || !validateGroupedChoices()) return;

  pendingPayload = collectPayload();
  renderSummary(pendingPayload);
  setConfirmationMode(true);
  summaryContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

editButton.addEventListener("click", () => {
  pendingPayload = null;
  setConfirmationMode(false);
  summaryContent.className = "summary-empty";
  summaryContent.textContent = "修改後請再按一次送出報名，系統會重新產生摘要。";
});

confirmSubmitButton.addEventListener("click", async () => {
  if (!pendingPayload) return;

  const payload = pendingPayload;
  confirmSubmitButton.disabled = true;
  editButton.disabled = true;
  confirmSubmitButton.textContent = "送出中";

  try {
    const result = await createRegistration(payload);
    pendingPayload = null;
    setConfirmationMode(false);
    renderSummary(payload, result);
    keepSummaryAfterReset = true;
    form.reset();
    summaryContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = `報名資料送出失敗：${error.message}`;
    form.querySelector(".form-actions").prepend(message);
  } finally {
    confirmSubmitButton.disabled = false;
    editButton.disabled = false;
    confirmSubmitButton.textContent = "確認報名";
  }
});

async function loadSettings() {
  try {
    appSettings = await loadRemoteSettings();
  } catch (error) {
    brochureNote.textContent = error.message;
  } finally {
    updateBrochure(appSettings);
    updateGradePanel();
    updateConditionalGroups();
  }
}

brochureLink.addEventListener("click", () => {
  if (!brochureLink.getAttribute("href")) return;
  confirmRules.disabled = false;
  brochureNote.textContent = "已開啟招生簡章。閱讀完畢後，請回到本頁勾選確認。";
});

loadSettings();
