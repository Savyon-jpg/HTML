const mainArea = document.getElementById("mainArea");
const lessonList = document.getElementById("lessonList");

const SUPABASE_URL = "https://gonfodbllgdzuuvnkdko.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PY57jZeJiAIaJSHDPrbCeg_r1eC4FC8";
const STUDENT_ID = "savyon";
const PROGRESS_TABLE = "progress";

let supabaseClient = null;
let progressCache = [];

function initSupabase() {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase library not loaded. Check index.html.");
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.?!,;:'"״׳]/g, "")
    .toLowerCase();
}

function answerLetter(index) {
  return ["א", "ב", "ג", "ד"][index] || "";
}

async function loadProgress() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from(PROGRESS_TABLE)
    .select("*")
    .eq("student_id", STUDENT_ID)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading progress:", error);
    progressCache = [];
    return;
  }

  progressCache = data || [];
}

function getLessonProgress(lessonId) {
  return progressCache.find(row => row.lesson_id === lessonId);
}

function renderLessonList() {
  lessonList.innerHTML = "";

  LESSONS.forEach((lesson, index) => {
    const btn = document.createElement("button");
    const saved = getLessonProgress(lesson.id);

    btn.className = "lesson-btn";
    btn.textContent = `${index + 1}. ${lesson.title}${saved ? " ✓" : ""}`;
    btn.onclick = () => renderLesson(lesson);

    lessonList.appendChild(btn);
  });
}

function renderHome() {
  const completed = progressCache.length;
  const average = completed
    ? Math.round(progressCache.reduce((sum, row) => sum + Number(row.percent || 0), 0) / completed)
    : 0;

  const progressPercent = Math.round((completed / LESSONS.length) * 100);

  const recentRows = progressCache.slice(0, 5).map(row => `
    <tr>
      <td>${escapeHtml(row.lesson_title || row.lesson_id)}</td>
      <td>${escapeHtml(row.score)}/${escapeHtml(row.total)}</td>
      <td>${escapeHtml(row.percent)}%</td>
      <td>${row.updated_at ? new Date(row.updated_at).toLocaleString("he-IL") : ""}</td>
    </tr>
  `).join("");

  mainArea.innerHTML = `
    <h2>דף הבית</h2>

    <div class="card">
      <p>שיעורים שהושלמו: <strong>${completed}</strong> מתוך <strong>${LESSONS.length}</strong></p>
      <div class="progress-bar"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
      <p>התקדמות: <strong>${progressPercent}%</strong></p>
      <p>ממוצע ציונים: <strong>${average}%</strong></p>
    </div>

    <h3>ציונים אחרונים</h3>
    ${
      completed
        ? `<table>
            <thead>
              <tr>
                <th>שיעור</th>
                <th>ציון</th>
                <th>אחוז</th>
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>${recentRows}</tbody>
          </table>`
        : `<p>בחר שיעור מהרשימה בצד ימין.</p>`
    }
  `;
}

function renderLesson(lesson) {
  let html = `
    <h2>${escapeHtml(lesson.title)}</h2>
    <p class="small">${escapeHtml(lesson.unit || "")}</p>

    <h3>אוצר מילים</h3>
    <ul>
      ${lesson.vocabulary.map(v => `<li><strong>${escapeHtml(v[0])}</strong> — ${escapeHtml(v[1])}</li>`).join("")}
    </ul>

    <h3>טקסט</h3>
    <div class="reading-text">${lesson.reading}</div>

    <h3>שאלות הבנת הנקרא</h3>
  `;

  lesson.comprehension.forEach((q, i) => {
    html += `
      <div class="question">
        <p><strong>${i + 1}. ${escapeHtml(q[0])}</strong></p>
        ${q[1].map((ans, j) => `
          <label>
            <input type="radio" name="q${i}" value="${j}">
            ${answerLetter(j)}. ${escapeHtml(ans)}
          </label><br>
        `).join("")}
      </div>
    `;
  });

  if (lesson.grammar && lesson.grammar.length) {
    html += `<h3>דקדוק</h3>`;

    lesson.grammar.forEach((q, i) => {
      html += `
        <div class="question">
          <p><strong>${i + 1}. ${escapeHtml(q[0])}</strong></p>
          ${q[1].map((ans, j) => `
            <label>
              <input type="radio" name="g${i}" value="${j}">
              ${answerLetter(j)}. ${escapeHtml(ans)}
            </label><br>
          `).join("")}
        </div>
      `;
    });
  }

  if (lesson.cloze && lesson.cloze.length) {
    html += `
      <h3>השלמת מילים</h3>
      <p><strong>בנק מילים:</strong> ${escapeHtml(lesson.clozeBank.join(" | "))}</p>
    `;

    lesson.cloze.forEach((q, i) => {
      html += `
        <div class="question">
          <label>
            ${i + 1}. ${escapeHtml(q[0])}
            <input id="cloze${i}" type="text" autocomplete="off">
          </label>
        </div>
      `;
    });
  }

  html += `
    <button class="main-btn" onclick="checkLesson('${escapeHtml(lesson.id)}')">בדוק שיעור</button>
    <div id="resultBox"></div>
  `;

  mainArea.innerHTML = html;
}

function collectMistakesAndScore(lesson) {
  let score = 0;
  let total = 0;
  const mistakes = [];
  const wrongWords = [];

  lesson.comprehension.forEach((q, i) => {
    total++;
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    const given = checked ? Number(checked.value) : null;
    const correct = Number(q[2]);

    if (given === correct) {
      score++;
    } else {
      mistakes.push({
        section: "הבנת הנקרא",
        questionNumber: i + 1,
        question: q[0],
        given: given === null ? "לא נבחרה תשובה" : `${answerLetter(given)}. ${q[1][given]}`,
        correct: `${answerLetter(correct)}. ${q[1][correct]}`
      });
    }
  });

  if (lesson.grammar) {
    lesson.grammar.forEach((q, i) => {
      total++;
      const checked = document.querySelector(`input[name="g${i}"]:checked`);
      const given = checked ? Number(checked.value) : null;
      const correct = Number(q[2]);

      if (given === correct) {
        score++;
      } else {
        mistakes.push({
          section: "דקדוק",
          questionNumber: i + 1,
          question: q[0],
          given: given === null ? "לא נבחרה תשובה" : `${answerLetter(given)}. ${q[1][given]}`,
          correct: `${answerLetter(correct)}. ${q[1][correct]}`
        });
      }
    });
  }

  if (lesson.cloze) {
    lesson.cloze.forEach((q, i) => {
      total++;
      const input = document.getElementById(`cloze${i}`);
      const given = input ? input.value.trim() : "";
      const correct = q[1];

      if (normalizeAnswer(given) === normalizeAnswer(correct)) {
        score++;
      } else {
        mistakes.push({
          section: "השלמת מילים",
          questionNumber: i + 1,
          question: q[0],
          given: given || "לא נכתבה תשובה",
          correct
        });

        wrongWords.push({
          lesson_id: lesson.id,
          lesson_title: lesson.title,
          prompt: q[0],
          user_answer: given || "",
          correct_answer: correct
        });
      }
    });
  }

  return {
    score,
    total,
    percent: total ? Math.round((score / total) * 100) : 0,
    mistakes,
    wrongWords
  };
}

async function saveProgressToSupabase(lesson, result) {
  if (!supabaseClient) return false;

  const payload = {
    student_id: STUDENT_ID,
    lesson_id: lesson.id,
    lesson_title: lesson.title,
    score: result.score,
    total: result.total,
    percent: result.percent,
    mistakes: result.mistakes,
    wrong_words: result.wrongWords,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(PROGRESS_TABLE)
    .upsert(payload, { onConflict: "student_id,lesson_id" });

  if (error) {
    console.error("Error saving progress:", error);
    return false;
  }

  await loadProgress();
  renderLessonList();
  return true;
}

async function checkLesson(id) {
  const lesson = LESSONS.find(l => l.id === id);
  const result = collectMistakesAndScore(lesson);

  const mistakesHtml = result.mistakes.length
    ? `<h3>טעויות</h3>
       ${result.mistakes.map(m => `
        <div class="question">
          <p class="wrong">❌ ${escapeHtml(m.section)} ${escapeHtml(m.questionNumber)}</p>
          <p>${escapeHtml(m.question)}</p>
          <p>התשובה שלך: <strong>${escapeHtml(m.given)}</strong></p>
          <p>התשובה הנכונה: <strong>${escapeHtml(m.correct)}</strong></p>
        </div>
       `).join("")}`
    : `<p class="correct">כל הכבוד — אין טעויות.</p>`;

  document.getElementById("resultBox").innerHTML = `
    <h3>ציון: ${result.score}/${result.total} — ${result.percent}%</h3>
    ${mistakesHtml}
    <p id="saveStatus">שומר ל-Supabase...</p>
  `;

  const saved = await saveProgressToSupabase(lesson, result);

  document.getElementById("saveStatus").textContent = saved
    ? "נשמר ב-Supabase."
    : "השמירה נכשלה. בדוק שהרצת את קובץ ה-SQL ושההרשאות פתוחות.";
}

function renderWrongWordsReview() {
  const wrongWords = progressCache.flatMap(row => row.wrong_words || []);

  if (!wrongWords.length) {
    mainArea.innerHTML = `
      <h2>חזרה על מילים שטעיתי בהן</h2>
      <p>אין עדיין מילים שגויות לחזרה.</p>
    `;
    return;
  }

  mainArea.innerHTML = `
    <h2>חזרה על מילים שטעיתי בהן</h2>
    ${wrongWords.map((item, i) => `
      <div class="question">
        <p><strong>${i + 1}. ${escapeHtml(item.lesson_title)}</strong></p>
        <p>${escapeHtml(item.prompt)}</p>
        <p>התשובה שלך: <span class="wrong">${escapeHtml(item.user_answer || "לא נכתבה תשובה")}</span></p>
        <p>התשובה הנכונה: <span class="correct">${escapeHtml(item.correct_answer)}</span></p>
      </div>
    `).join("")}
  `;
}

function renderWrongQuestionsReview() {
  const mistakes = progressCache.flatMap(row =>
    (row.mistakes || []).map(m => ({
      ...m,
      lesson_title: row.lesson_title
    }))
  );

  if (!mistakes.length) {
    mainArea.innerHTML = `
      <h2>חזרה על שאלות שטעיתי בהן</h2>
      <p>אין עדיין שאלות שגויות לחזרה.</p>
    `;
    return;
  }

  mainArea.innerHTML = `
    <h2>חזרה על שאלות שטעיתי בהן</h2>
    ${mistakes.map((m, i) => `
      <div class="question">
        <p><strong>${i + 1}. ${escapeHtml(m.lesson_title)} — ${escapeHtml(m.section)}</strong></p>
        <p>${escapeHtml(m.question)}</p>
        <p>התשובה שלך: <span class="wrong">${escapeHtml(m.given)}</span></p>
        <p>התשובה הנכונה: <span class="correct">${escapeHtml(m.correct)}</span></p>
      </div>
    `).join("")}
  `;
}

async function resetProgress() {
  const ok = confirm("האם למחוק את כל ההתקדמות של סביון?");
  if (!ok || !supabaseClient) return;

  const { error } = await supabaseClient
    .from(PROGRESS_TABLE)
    .delete()
    .eq("student_id", STUDENT_ID);

  if (error) {
    alert("האיפוס נכשל. בדוק הרשאת delete בטבלת progress.");
    console.error(error);
    return;
  }

  await loadProgress();
  renderLessonList();
  renderHome();
}

async function startApp() {
  initSupabase();
  await loadProgress();

  document.getElementById("homeBtn").onclick = renderHome;
  document.getElementById("reviewWordsBtn").onclick = renderWrongWordsReview;
  document.getElementById("reviewQuestionsBtn").onclick = renderWrongQuestionsReview;
  document.getElementById("resetBtn").onclick = resetProgress;

  renderLessonList();
  renderHome();
}

startApp();
