const mainArea = document.getElementById("mainArea");
const lessonList = document.getElementById("lessonList");

const homeBtn = document.getElementById("homeBtn");
const reviewBtn = document.getElementById("reviewBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importFileBtn = document.getElementById("importFileBtn");
const importFile = document.getElementById("importFile");
const importOldBtn = document.getElementById("importOldBtn");

const STUDENT_ID = "savyon";
const SUPABASE_URL = "https://gonfodbllgdzuuvnkdko.supabase.co";
const SUPABASE_KEY = "sb_publishable_PY57jZeJiAIaJSHDPrbCeg_r1eC4FC8";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const OLD_PROGRESS_KEY = "hebrewCourseV2Progress";
const OLD_WRONG_KEY = "hebrewCourseV2WrongWords";

function emptyData() {
  return { lessons: {}, wrongWords: [], backups: [] };
}

function normalizeData(data) {
  return {
    lessons: data?.lessons && typeof data.lessons === "object" ? data.lessons : {},
    wrongWords: Array.isArray(data?.wrongWords) ? data.wrongWords : [],
    backups: Array.isArray(data?.backups) ? data.backups : []
  };
}

function mergeData(oldData, newData) {
  const a = normalizeData(oldData);
  const b = normalizeData(newData);

  const lessons = { ...a.lessons };

  for (const [id, incoming] of Object.entries(b.lessons)) {
    const existing = lessons[id];

    if (!existing) {
      lessons[id] = incoming;
      continue;
    }

    const existingPercent = Number(existing.percent || 0);
    const incomingPercent = Number(incoming.percent || 0);

    // שומר את הציון הגבוה יותר, כדי שייבוא ישן לא יוריד התקדמות קיימת.
    lessons[id] = incomingPercent >= existingPercent ? incoming : existing;
  }

  return {
    lessons,
    wrongWords: [...new Set([...a.wrongWords, ...b.wrongWords])],
    backups: [...(a.backups || []), ...(b.backups || [])].slice(-10)
  };
}

function normalize(s) {
  return (s || "").trim().replace(/[״׳"]/g, "").replace(/\s+/g, " ");
}

function radioValue(name) {
  const e = document.querySelector(`input[name="${name}"]:checked`);
  return e ? Number(e.value) : null;
}

function showError(err) {
  mainArea.innerHTML = `
    <h2>שגיאה</h2>
    <p>יש בעיה בטעינה או בשמירת ההתקדמות.</p>
    <pre>${err?.message || err}</pre>
  `;
}

async function getData() {
  const { data, error } = await db
    .from("progress")
    .select("data")
    .eq("student_id", STUDENT_ID)
    .maybeSingle();

  if (error) throw error;
  return normalizeData(data?.data || emptyData());
}

async function saveData(nextData) {
  const current = await getData().catch(() => emptyData());
  const backup = {
    date: new Date().toISOString(),
    lessons: current.lessons,
    wrongWords: current.wrongWords
  };

  const finalData = normalizeData(nextData);
  finalData.backups = [...(current.backups || []), backup].slice(-10);

  const { error } = await db
    .from("progress")
    .upsert({ student_id: STUDENT_ID, data: finalData });

  if (error) throw error;
}

async function renderLessonList() {
  const data = await getData();
  const p = data.lessons || {};
  lessonList.innerHTML = "";

  let unit = "";
  LESSONS.forEach(l => {
    if (l.unit !== unit) {
      unit = l.unit;
      const h = document.createElement("h3");
      h.textContent = unit;
      lessonList.appendChild(h);
    }

    const b = document.createElement("button");
    b.className = "lesson-btn" + (p[l.id] ? " done" : "");
    b.textContent = `${l.title}${p[l.id] ? " ✓" : ""}`;
    b.onclick = () => renderLesson(l);
    lessonList.appendChild(b);
  });
}

async function renderHome() {
  try {
    const data = await getData();
    const p = data.lessons || {};
    const w = data.wrongWords || [];
    const scores = Object.values(p);
    const done = Object.keys(p).length;
    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + Number(b.percent || 0), 0) / scores.length)
      : 0;

    mainArea.innerHTML = `
      <h2>דף הבית</h2>
      <p>קורס קיץ בעברית לדובר אנגלית.</p>

      <div class="cards">
        <div class="card"><strong>${done}</strong><span>שיעורים הושלמו</span></div>
        <div class="card"><strong>${avg}%</strong><span>ממוצע</span></div>
        <div class="card"><strong>${LESSONS.length}</strong><span>שיעורים זמינים</span></div>
        <div class="card"><strong>${w.length}</strong><span>מילים לחזרה</span></div>
      </div>

      <h3>ציונים אחרונים</h3>
      ${
        scores.length
          ? `<ul>${Object.entries(p).map(([id, item]) => {
              const l = LESSONS.find(x => x.id === id);
              return `<li>${l?.title || id}: ${item.score}/${item.total} (${item.percent}%)</li>`;
            }).join("")}</ul>`
          : "<p>עדיין אין ציונים.</p>"
      }
    `;
    await renderLessonList();
  } catch (err) {
    showError(err);
  }
}

function renderLesson(l) {
  mainArea.innerHTML = `
    <h2>${l.title}</h2>
    <p class="unit">${l.unit}</p>

    <h3>חלק א׳ – אוצר מילים</h3>
    ${l.vocabulary.map((pair, i) => `
      <label class="question">
        ${i + 1}. ${pair[0]}
        <select id="vocab_${i}">
          <option value="">בחר פירוש</option>
          ${l.vocabulary.map((p, j) => `<option value="${j}">${p[1]}</option>`).join("")}
        </select>
      </label>
    `).join("")}

    <h3>חלק ב׳ – קריאה</h3>
    <div class="reading">${l.reading}</div>

    <h3>חלק ג׳ – הבנת הנקרא</h3>
    ${l.comprehension.map((q, i) => Array.isArray(q) ? `
      <div class="question">
        <p>${i + 1}. ${q[0]}</p>
        ${q[1].map((o, j) => `
          <label><input type="radio" name="comp_${i}" value="${j}"> ${o}</label>
        `).join("")}
      </div>
    ` : `
      <label class="question">
        ${i + 1}. ${q.text}
        <textarea id="open_${i}" rows="3"></textarea>
      </label>
    `).join("")}

    <h3>חלק ד׳ – דקדוק</h3>
    ${l.grammar.map((q, i) => `
      <div class="question">
        <p>${i + 1}. ${q[0]}</p>
        ${q[1].map((o, j) => `
          <label><input type="radio" name="gram_${i}" value="${j}"> ${o}</label>
        `).join("")}
      </div>
    `).join("")}

    <h3>חלק ה׳ – Cloze</h3>
    <p><strong>בנק מילים:</strong> ${l.clozeBank.join(" | ")}</p>
    ${l.cloze.map((q, i) => `
      <label class="question">
        ${i + 1}. ${q[0]}
        <input id="cloze_${i}" type="text">
      </label>
    `).join("")}

    <button class="submit-btn" onclick="gradeLesson('${l.id}')">בדוק שיעור</button>
    <div id="resultBox"></div>
  `;

  scrollTo({ top: 0, behavior: "smooth" });
}

window.gradeLesson = async function(id) {
  try {
    const l = LESSONS.find(x => x.id === id);
    let score = 0;
    let total = 0;
    const parts = { vocab: [0, 0], reading: [0, 0], grammar: [0, 0], cloze: [0, 0] };
    const fb = [];

    const data = await getData();
    const wrong = data.wrongWords || [];

    l.vocabulary.forEach((pair, i) => {
      total++;
      parts.vocab[1]++;
      const v = document.getElementById(`vocab_${i}`).value;
      if (Number(v) === i) {
        score++;
        parts.vocab[0]++;
      } else {
        fb.push(`אוצר מילים: ${pair[0]} = ${pair[1]}`);
        wrong.push(pair[0] + " = " + pair[1]);
      }
    });

    l.comprehension.forEach((q, i) => {
      total += 2;
      parts.reading[1] += 2;

      if (Array.isArray(q)) {
        const v = radioValue(`comp_${i}`);
        if (v === q[2]) {
          score += 2;
          parts.reading[0] += 2;
        } else {
          fb.push(`הבנת הנקרא ${i + 1}: התשובה הנכונה היא "${q[1][q[2]]}".`);
        }
      } else {
        const ans = normalize(document.getElementById(`open_${i}`)?.value || "");
        const hit = (q.keywords || []).filter(k => ans.includes(k)).length;
        const pts = hit ? 2 : ans.length > 10 ? 1 : 0;
        score += pts;
        parts.reading[0] += pts;
        fb.push(`שאלה פתוחה ${i + 1}: תשובה טובה תכלול רעיון כמו: ${(q.keywords || []).join(" / ")}.`);
      }
    });

    l.grammar.forEach((q, i) => {
      total++;
      parts.grammar[1]++;
      const v = radioValue(`gram_${i}`);
      if (v === q[2]) {
        score++;
        parts.grammar[0]++;
      } else {
        fb.push(`דקדוק ${i + 1}: התשובה הנכונה היא "${q[1][q[2]]}".`);
      }
    });

    l.cloze.forEach((q, i) => {
      total++;
      parts.cloze[1]++;
      const v = normalize(document.getElementById(`cloze_${i}`).value);
      if (v === q[1]) {
        score++;
        parts.cloze[0]++;
      } else {
        fb.push(`Cloze ${i + 1}: התשובה הנכונה היא "${q[1]}".`);
      }
    });

    const percent = Math.round((score / total) * 100);

    data.lessons[id] = {
      score,
      total,
      percent,
      parts,
      date: new Date().toLocaleDateString("he-IL")
    };
    data.wrongWords = [...new Set(wrong)];

    await saveData(data);

    document.getElementById("resultBox").innerHTML = `
      <h3>ציון: ${score}/${total} (${percent}%)</h3>
      <p>
        אוצר מילים: ${parts.vocab[0]}/${parts.vocab[1]} |
        הבנת הנקרא: ${parts.reading[0]}/${parts.reading[1]} |
        דקדוק: ${parts.grammar[0]}/${parts.grammar[1]} |
        Cloze: ${parts.cloze[0]}/${parts.cloze[1]}
      </p>
      <h3>משוב</h3>
      ${fb.length ? `<ul>${fb.map(x => `<li>${x}</li>`).join("")}</ul>` : "<p>מעולה! הכול נכון.</p>"}
    `;

    await renderLessonList();
  } catch (err) {
    showError(err);
  }
};

async function renderReview() {
  try {
    const data = await getData();
    const w = data.wrongWords || [];
    mainArea.innerHTML = `
      <h2>חזרה על מילים שטעיתי בהן</h2>
      ${w.length ? `<ul>${w.map(x => `<li>${x}</li>`).join("")}</ul>` : "<p>אין עדיין מילים לחזרה.</p>"}
    `;
  } catch (err) {
    showError(err);
  }
}

exportBtn.onclick = async () => {
  const data = await getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `savyon-progress-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

importFileBtn.onclick = () => importFile.click();

importFile.onchange = async () => {
  try {
    const file = importFile.files[0];
    if (!file) return;

    const text = await file.text();
    const imported = normalizeData(JSON.parse(text));
    const current = await getData();
    const merged = mergeData(current, imported);

    await saveData(merged);
    alert("הגיבוי מוזג עם ההתקדמות הקיימת. שום ציון קיים לא נמחק.");
    await renderHome();
  } catch (err) {
    showError(err);
  }
};

importOldBtn.onclick = async () => {
  try {
    const oldProgress = JSON.parse(localStorage.getItem(OLD_PROGRESS_KEY) || "{}");
    const oldWrongWords = JSON.parse(localStorage.getItem(OLD_WRONG_KEY) || "[]");

    if (!Object.keys(oldProgress).length && !oldWrongWords.length) {
      alert("לא נמצאה התקדמות ישנה במחשב הזה.");
      return;
    }

    const current = await getData();
    const oldData = { lessons: oldProgress, wrongWords: oldWrongWords };
    const merged = mergeData(current, oldData);

    await saveData(merged);
    alert("ההתקדמות הישנה מוזגה בלי לדרוס את ההתקדמות בענן.");
    await renderHome();
  } catch (err) {
    showError(err);
  }
};

resetBtn.onclick = async () => {
  const first = confirm("זה יאפס את כל ההתקדמות בענן. להמשיך?");
  if (!first) return;

  const second = confirm("אישור נוסף: האם אתה בטוח לגמרי?");
  if (!second) return;

  await saveData(emptyData());
  await renderHome();
};

homeBtn.onclick = renderHome;
reviewBtn.onclick = renderReview;

renderHome();
