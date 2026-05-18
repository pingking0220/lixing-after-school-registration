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

let appSettings = {
  registrationTerm: "nextYearFirst",
  registrationTermLabel: "下一學年度上學期",
  brochurePath: "brochures/115-1課後照顧班招生簡章(二到六年級).pdf",
  brochureName: "115-1課後照顧班招生簡章(二到六年級).pdf"
};

const gradeKey = {
  "低年級": "low",
  "中年級": "mid",
  "高年級": "high"
};

const gradeNames = {
  1: "一年級",
  2: "二年級",
  3: "三年級",
  4: "四年級",
  5: "五年級",
  6: "六年級"
};

const chineseGrades = {
  "一": 1,
  "二": 2,
  "三": 3,
  "四": 4,
  "五": 5,
  "六": 6,
  "壹": 1,
  "貳": 2,
  "參": 3,
  "肆": 4,
  "伍": 5,
  "陸": 6
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

function parseGradeFromClassName(value) {
  const text = value.trim().replace(/\s+/g, "");
  if (!text) return 0;

  const digitBeforeGrade = text.match(/^([1-6])(年|年級)/);
  if (digitBeforeGrade) return Number(digitBeforeGrade[1]);

  const chineseBeforeGrade = text.match(/^([一二三四五六壹貳參肆伍陸])(年|年級)/);
  if (chineseBeforeGrade) return chineseGrades[chineseBeforeGrade[1]] || 0;

  const threeDigitClassCode = text.match(/^([1-6])\d{2}$/);
  if (threeDigitClassCode) return Number(threeDigitClassCode[1]);

  return 0;
}

function updateGradeFromClassName() {
  const grade = parseGradeFromClassName(fieldValue("className"));
  const currentGrade = form.querySelector('[name="currentGrade"]');

  if (!fieldValue("className")) {
    currentGrade.value = "";
    classHint.textContent = "可輸入二年三班、2年3班或203，系統會自動判斷年級。";
    updateGradePanel();
    updateConditionalGroups();
    return;
  }

  if (grade) {
    currentGrade.value = String(grade);
    classHint.textContent = `已依班級判斷目前為${gradeNames[grade]}。`;
  } else {
    currentGrade.value = "";
    classHint.textContent = "未能自動判斷年級，請改用例如二年三班、2年3班或203的格式。";
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

function updateBrochure(settings) {
  const path = settings.brochurePath || "";
  const name = settings.brochureName || "尚未設定簡章";
  brochureName.textContent = name;

  if (!path) {
    brochureLink.removeAttribute("href");
    brochureNote.textContent = "目前尚未設定招生簡章，請聯絡學校確認。";
    confirmRules.disabled = true;
    return;
  }

  brochureLink.href = path;
  brochureNote.textContent = "請先點選上方連結另開簡章，閱讀後即可勾選家長確認。";
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
    gradeResult.textContent = "輸入目前班級後，系統會自動判斷報名年段。";
  } else if (enrollment.number > 6) {
    gradeResult.textContent = "此學生下一學年度將升上國中，請確認是否仍需填寫國小課後照顧班報名。";
  } else {
    gradeResult.textContent = `目前設定為${appSettings.registrationTermLabel}，報名時身分：${enrollment.name}，屬於${enrollment.band}。`;
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
  setGroupEnabled(subsidyTypes, checkedValue("subsidy") === "有減免身分");

  if (!key) return;
}

function validateGroupedChoices() {
  form.querySelectorAll(".error-message").forEach((item) => item.remove());

  const messages = [];
  const enrollment = getEnrollmentGrade();
  const grade = enrollment.band;
  const key = gradeKey[grade];

  if (confirmRules.disabled || !confirmRules.checked) {
    messages.push("請先閱讀招生簡章，並勾選已詳閱確認。");
  }

  if (!fieldValue("currentGrade")) {
    messages.push("請確認目前班級格式，例如二年三班、2年3班或203。");
  }

  if (enrollment.number > 6) {
    messages.push("學生報名時年級超過國小六年級，請重新確認目前班級或聯絡學校。");
  }

  if (key && checkedValue(`care_${key}`) === "是" && checkedValues(`careDays_${key}`).length === 0) {
    messages.push("請至少勾選一個課後照顧班參加日期。");
  }

  if (checkedValue("extended") === "是" && checkedValues("extendedDays").length === 0) {
    messages.push("請至少勾選一個延長班參加日期。");
  }

  if (checkedValue("subsidy") === "有減免身分" && checkedValues("subsidyTypes").length === 0) {
    messages.push("請至少勾選一項減免身分別。");
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

function renderSummary(submitResult = {}) {
  const enrollment = getEnrollmentGrade();
  const grade = enrollment.band;
  const key = gradeKey[grade];
  const list = document.createElement("dl");

  if (submitResult.id) {
    addSummaryRow(list, "報名編號", String(submitResult.id));
    addSummaryRow(list, "送出時間", submitResult.submitted_at);
  }

  addSummaryRow(list, "學生姓名", fieldValue("studentName"));
  addSummaryRow(list, "學生性別", checkedValue("gender"));
  addSummaryRow(list, "目前班級", fieldValue("className"));
  addSummaryRow(list, "家長姓名", fieldValue("parentName"));
  addSummaryRow(list, "家長手機", fieldValue("parentPhone"));
  addSummaryRow(list, "Email", fieldValue("email"));
  addSummaryRow(list, "報名學期", appSettings.registrationTermLabel);
  addSummaryRow(list, "學生目前年級", gradeNames[Number(fieldValue("currentGrade"))] || "");
  addSummaryRow(list, "報名時年級", enrollment.name);
  addSummaryRow(list, "報名時年段", grade);
  addSummaryRow(list, "課後照顧班", key ? checkedValue(`care_${key}`) : "");
  addSummaryRow(list, "課後照顧班日期", key ? checkedValues(`careDays_${key}`).join("、") : "");
  addSummaryRow(list, "延長班", checkedValue("extended"));
  addSummaryRow(list, "延長班日期", checkedValues("extendedDays").join("、"));
  addSummaryRow(list, "午餐需求", checkedValue("lunch"));
  addSummaryRow(list, "減免身分", checkedValue("subsidy"));
  addSummaryRow(list, "減免身分別", checkedValues("subsidyTypes").join("、"));
  addSummaryRow(list, "特別協助事項", fieldValue("notes"));

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
    registrationTerm: appSettings.registrationTermLabel,
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
  window.setTimeout(() => {
    classHint.textContent = "可輸入二年三班、2年3班或203，系統會自動判斷年級。";
    updateGradePanel();
    updateConditionalGroups();
    summaryContent.className = "summary-empty";
    summaryContent.textContent = "送出表單後會在這裡顯示確認內容。";
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateGradeFromClassName();
  updateConditionalGroups();

  if (!form.reportValidity() || !validateGroupedChoices()) return;

  const submitButton = form.querySelector(".primary-button");
  submitButton.disabled = true;
  submitButton.textContent = "送出中";

  try {
    const result = await createRegistration(collectPayload());
    renderSummary(result);
    form.reset();
    summaryContent.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = `報名資料未寫入 Firebase：${error.message}`;
    form.querySelector(".form-actions").prepend(message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出報名";
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
  confirmRules.disabled = false;
  brochureNote.textContent = "已開啟招生簡章，閱讀完成後請勾選下方確認。";
});

loadSettings();
