const lessonList = document.getElementById("lessonList");
const quizArea = document.getElementById("quizArea");
const progressBox = document.getElementById("progressBox");
const resetBtn = document.getElementById("resetBtn");

function saveProgress(lessonId, score, total) {
  const data = JSON.parse(localStorage.getItem("hebrewCourseProgress") || "{}");
  data[lessonId] = { score, total, percent: Math.round(score / total * 100), date: new Date().toLocaleDateString("he-IL") };
  localStorage.setItem("hebrewCourseProgress", JSON.stringify(data));
  renderProgress();
}

function renderProgress() {
  const data = JSON.parse(localStorage.getItem("hebrewCourseProgress") || "{}");
  const entries = Object.entries(data);
  if (!entries.length) {
    progressBox.textContent = "עדיין אין ציונים.";
    return;
  }
  progressBox.innerHTML = entries.map(([id, item]) => {
    const lesson = LESSONS.find(l => l.id === id);
    return `<p><strong>${lesson ? lesson.title : id}</strong>: ${item.score}/${item.total} (${item.percent}%) — ${item.date}</p>`;
  }).join("");
}

function renderLessonButtons() {
  lessonList.innerHTML = "";
  LESSONS.forEach(lesson => {
    const btn = document.createElement("button");
    btn.className = "lesson-btn";
    btn.textContent = lesson.title;
    btn.onclick = () => renderLesson(lesson);
    lessonList.appendChild(btn);
  });
}

function optionName(prefix, i) {
  return `${prefix}_${i}`;
}

function renderLesson(lesson) {
  quizArea.classList.remove("hidden");
  quizArea.innerHTML = `
    <h2>${lesson.title}</h2>

    <h3>חלק א׳ – אוצר מילים: התאמה</h3>
    <p>בחר את הפירוש באנגלית לכל מילה.</p>
    ${lesson.vocabulary.map((pair, i) => `
      <div class="question">
        <strong>${i + 1}. ${pair[0]}</strong>
        <select id="vocab_${i}">
          <option value="">בחר תשובה</option>
          ${lesson.vocabulary.map((p, j) => `<option value="${j}">${p[1]}</option>`).join("")}
        </select>
      </div>
    `).join("")}

    <h3>חלק ב׳ – קריאה</h3>
    <div class="reading">${lesson.reading}</div>

    <h3>חלק ג׳ – הבנת הנקרא</h3>
    ${lesson.comprehension.map((q, i) => {
      if (q.type === "mc") {
        return `<div class="question">
          <strong>${i + 1}. ${q.text}</strong>
          <div class="options">
            ${q.options.map((opt, j) => `
              <label><input type="radio" name="${optionName("comp", i)}" value="${j}"> ${opt}</label>
            `).join("")}
          </div>
        </div>`;
      }
      return `<div class="question">
        <strong>${i + 1}. ${q.text}</strong>
        <textarea id="open_${i}" rows="3" placeholder="כתוב תשובה קצרה"></textarea>
        <p class="feedback">שאלה פתוחה: המערכת תיתן ניקוד בסיסי לפי מילות מפתח.</p>
      </div>`;
    }).join("")}

    <h3>חלק ד׳ – דקדוק</h3>
    ${lesson.grammar.map((q, i) => `
      <div class="question">
        <strong>${i + 1}. ${q.text}</strong>
        <div class="options">
          ${q.options.map((opt, j) => `
            <label><input type="radio" name="${optionName("gram", i)}" value="${j}"> ${opt}</label>
          `).join("")}
        </div>
      </div>
    `).join("")}

    <h3>חלק ה׳ – Cloze</h3>
    <p><strong>בנק מילים:</strong> ${lesson.clozeBank.join(" • ")}</p>
    ${lesson.cloze.map((q, i) => `
      <div class="question">
        <strong>${i + 1}. ${q[0]}</strong>
        <input type="text" id="cloze_${i}" />
      </div>
    `).join("")}

    <button id="checkBtn">בדוק מבחן</button>
    <div id="resultBox"></div>
  `;

  document.getElementById("checkBtn").onclick = () => gradeLesson(lesson);
  quizArea.scrollIntoView({ behavior: "smooth" });
}

function getRadioValue(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? Number(selected.value) : null;
}

function normalize(str) {
  return (str || "").trim().replace(/[״׳"]/g, "").replace(/\s+/g, " ");
}

function gradeLesson(lesson) {
  let score = 0;
  let total = 0;
  let feedback = [];

  // Vocabulary: 1 point each
  lesson.vocabulary.forEach((pair, i) => {
    total++;
    const val = document.getElementById(`vocab_${i}`).value;
    if (Number(val) === i) score++;
    else feedback.push(`אוצר מילים: "${pair[0]}" = ${pair[1]}`);
  });

  // Comprehension: MC 2 points, open 2 points basic keyword score
  lesson.comprehension.forEach((q, i) => {
    total += 2;
    if (q.type === "mc") {
      const val = getRadioValue(optionName("comp", i));
      if (val === q.answer) score += 2;
      else feedback.push(`הבנת הנקרא ${i + 1}: התשובה הנכונה היא "${q.options[q.answer]}".`);
    } else {
      const ans = normalize(document.getElementById(`open_${i}`).value);
      const hit = q.keywords.some(k => ans.includes(k));
      if (hit) score += 2;
      else if (ans.length > 4) score += 1;
      feedback.push(`שאלה פתוחה ${i + 1}: תשובה טובה תזכיר רעיון כמו: ${q.keywords.join(" / ")}.`);
    }
  });

  // Grammar: 1 point each
  lesson.grammar.forEach((q, i) => {
    total++;
    const val = getRadioValue(optionName("gram", i));
    if (val === q.answer) score++;
    else feedback.push(`דקדוק ${i + 1}: התשובה הנכונה היא "${q.options[q.answer]}".`);
  });

  // Cloze: 1 point each
  lesson.cloze.forEach((q, i) => {
    total++;
    const val = normalize(document.getElementById(`cloze_${i}`).value);
    if (val === q[1]) score++;
    else feedback.push(`Cloze ${i + 1}: התשובה הנכונה היא "${q[1]}".`);
  });

  const percent = Math.round(score / total * 100);
  saveProgress(lesson.id, score, total);

  document.getElementById("resultBox").innerHTML = `
    <div class="score">ציון: ${score}/${total} (${percent}%)</div>
    <h3>משוב</h3>
    ${feedback.length ? `<ul>${feedback.map(f => `<li>${f}</li>`).join("")}</ul>` : "<p>מעולה! הכול נכון.</p>"}
  `;
}

resetBtn.onclick = () => {
  localStorage.removeItem("hebrewCourseProgress");
  renderProgress();
};

renderLessonButtons();
renderProgress();
