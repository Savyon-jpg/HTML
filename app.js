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
    console.log("Supabase connected");
  } else {
    console.error("Supabase library not loaded. Check index.html");
  }
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

  const recent = progressCache.slice(0, 5).map(row => `
    <tr>
      <td>${row.lesson_title || row.lesson_id}</td>
      <td>${row.score}/${row.total}</td>
      <td>${row.percent}%</td>
      <td>${row.updated_at ? new Date(row.updated_at).toLocaleString("he-IL") : ""}</td>
    </tr>
  `).join("");

  mainArea.innerHTML = `
    <h2>ברוך הבא</h2>
    <p>שיעורים שהושלמו: <strong>${completed}</strong> מתוך <strong>${LESSONS.length}</strong></p>
    <p>ממוצע ציונים: <strong>${average}%</strong></p>

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
            <tbody>${recent}</tbody>
          </table>`
        : `<p>בחר שיעור מהרשימה בצד ימין.</p>`
    }
  `;
}

function renderLesson(lesson) {
  let html = `
    <h2>${lesson.title}</h2>
    <p>${lesson.unit || ""}</p>

    <h3>אוצר מילים</h3>
    <ul>
      ${lesson.vocabulary.map(v => `<li><strong>${v[0]}</strong> — ${v[1]}</li>`).join("")}
    </ul>

    <h3>טקסט</h3>
    <div>${lesson.reading}</div>

    <h3>שאלות הבנת הנקרא</h3>
  `;

  lesson.comprehension.forEach((q, i) => {
    html += `
      <div class="question">
        <p><strong>${i + 1}. ${q[0]}</strong></p>
        ${q[1].map((ans, j) => `
          <label>
            <input type="radio" name="q${i}" value="${j}">
            ${ans}
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
          <p><strong>${i + 1}. ${q[0]}</strong></p>
          ${q[1].map((ans, j) => `
            <label>
              <input type="radio" name="g${i}" value="${j}">
              ${ans}
            </label><br>
          `).join("")}
        </div>
      `;
    });
  }

  if (lesson.cloze && lesson.cloze.length) {
    html += `
      <h3>השלמת מילים</h3>
      <p><strong>בנק מילים:</strong> ${lesson.clozeBank.join(" | ")}</p>
    `;

    lesson.cloze.forEach((q, i) => {
      html += `
        <div class="question">
          <label>
            ${i + 1}. ${q[0]}
            <input id="cloze${i}" type="text" autocomplete="off">
          </label>
        </div>
      `;
    });
  }

  html += `
    <button class="main-btn safe" onclick="checkLesson('${lesson.id}')">בדוק שיעור</button>
    <div id="resultBox"></div>
  `;

  mainArea.innerHTML = html;
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.?!,;:'"״׳]/g, "");
}

async function saveProgressToSupabase(lesson, score, total, percent) {
  if (!supabaseClient) {
    console.error("No Supabase client");
    return false;
  }

  const payload = {
    student_id: STUDENT_ID,
    lesson_id: lesson.id,
    lesson_title: lesson.title,
    score,
    total,
    percent,
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
  let score = 0;
  let total = 0;

  lesson.comprehension.forEach((q, i) => {
    total++;
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (checked && Number(checked.value) === Number(q[2])) score++;
  });

  if (lesson.grammar) {
    lesson.grammar.forEach((q, i) => {
      total++;
      const checked = document.querySelector(`input[name="g${i}"]:checked`);
      if (checked && Number(checked.value) === Number(q[2])) score++;
    });
  }

  if (lesson.cloze) {
    lesson.cloze.forEach((q, i) => {
      total++;
      const input = document.getElementById(`cloze${i}`);
      const answer = input ? normalizeAnswer(input.value) : "";
      const correct = normalizeAnswer(q[1]);
      if (answer === correct) score++;
    });
  }

  const percent = total ? Math.round((score / total) * 100) : 0;

  document.getElementById("resultBox").innerHTML = `
    <h3>ציון: ${score}/${total} — ${percent}%</h3>
    <p id="saveStatus">שומר ל-Supabase...</p>
  `;

  const saved = await saveProgressToSupabase(lesson, score, total, percent);

  const status = document.getElementById("saveStatus");
  status.textContent = saved
    ? "נשמר ב-Supabase."
    : "השמירה ל-Supabase נכשלה. פתח Console כדי לראות את השגיאה.";
}

async function startApp() {
  initSupabase();
  await loadProgress();

  document.getElementById("homeBtn").onclick = renderHome;

  renderLessonList();
  renderHome();
}

startApp();
