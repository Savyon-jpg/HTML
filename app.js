const mainArea = document.getElementById("mainArea");
const lessonList = document.getElementById("lessonList");
const resetBtn = document.getElementById("resetBtn");
const homeBtn = document.getElementById("homeBtn");
const reviewBtn = document.getElementById("reviewBtn");
const importBtn = document.getElementById("importBtn");

const STUDENT_ID = "savyon";

const SUPABASE_URL = "https://gonfodbllgdzuuvnkdko.supabase.co";
const SUPABASE_KEY = "sb_publishable_PY57jZeJiAIaJSHDPrbCeg_r1eC4FC8";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const OLD_PROGRESS_KEY = "hebrewCourseV2Progress";
const OLD_WRONG_KEY = "hebrewCourseV2WrongWords";

function normalize(s) {
  return (s || "").trim().replace(/[״׳"]/g, "").replace(/\s+/g, " ");
}

function radioValue(n) {
  const e = document.querySelector(`input[name="${n}"]:checked`);
  return e ? Number(e.value) : null;
}

function showError(err) {
  mainArea.innerHTML = `
    <div class="card">
      <h2>שגיאה</h2>
      <p>יש בעיה בטעינה או בשמירת ההתקדמות.</p>
      <p class="small">${err.message || err}</p>
    </div>
  `;
}

async function getData() {
  const { data, error } = await db
    .from("progress")
    .select("data")
    .eq("student_id", STUDENT_ID)
    .maybeSingle();

  if (error) throw error;

  return data?.data || { lessons: {}, wrongWords: [] };
}

async function saveData(data) {
  const { error } = await db
    .from("progress")
    .upsert({
      student_id: STUDENT_ID,
      data
    });

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

    const done = Object.keys(p).length;
    const scores = Object.values(p);
    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b.percent, 0) / scores.length)
      : 0;

    mainArea.innerHTML = `
      <div class="card">
        <h2>דף הבית</h2>
        <p>קורס קיץ בעברית לדובר אנגלית. בכל שיעור יש אוצר מילים, קריאה, הבנת הנקרא, דקדוק ו-Cloze.</p>

        <div class="grid">
          <div class="stat"><strong>${done}</strong>שיעורים הושלמו</div>
          <div class="stat"><strong>${avg}%</strong>ממוצע</div>
          <div class="stat"><strong>${LESSONS.length}</strong>שיעורים זמינים</div>
          <div class="stat"><strong>${w.length}</strong>מילים לחזרה</div>
        </div>

        <h3>ציונים אחרונים</h3>
        ${
          scores.length
            ? Object.entries(p).map(([id, item]) => {
                const l = LESSONS.find(x => x.id === id);
                return `<p><strong>${l?.title || id}</strong>: ${item.score}/${item.total} (${item.percent}%)</p>`;
              }).join("")
            : "<p>עדיין אין ציונים.</p>"
        }
      </div>
    `;

    await renderLessonList();
  } catch (err) {
    showError(err);
  }
}

function renderLesson(l) {
  mainArea.innerHTML = `
    <div class="card">
      <h2>${l.title}</h2>
      <p class="small">${l.unit}</p>

      <div class="part">
        <h3>חלק א׳ – אוצר מילים</h3>
        <p>התאם בין המילה בעברית לפירוש באנגלית.</p>
        ${l.vocabulary.map((pair, i) => `
          <div class="question">
            <strong>${i + 1}. ${pair[0]}</strong>
            <select id="vocab_${i}">
              <option value="">בחר פירוש</option>
              ${l.vocabulary.map((p, j) => `<option value="${j}">${p[1]}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </div>

      <div class="part">
        <h3>חלק ב׳ – קריאה</h3>
        <div class="reading">${l.reading}</div>
      </div>

      <div class="part">
        <h3>חלק ג׳ – הבנת הנקרא</h3>
        ${l.comprehension.map((q, i) =>
          Array.isArray(q)
            ? `
              <div class="question">
                <strong>${i + 1}. ${q[0]}</strong>
                <div class="options">
                  ${q[1].map((o, j) => `
                    <label><input type="radio" name="comp_${i}" value="${j}"> ${o}</label>
                  `).join("")}
                </div>
              </div>
            `
            : `
              <div class="question">
                <strong>${i + 1}. ${q.text}</strong>
                <textarea id="open_${i}" rows="4" placeholder="כתוב תשובה קצרה"></textarea>
                <p class="small">בדיקה בסיסית לפי מילות מפתח.</p>
              </div>
            `
        ).join("")}
      </div>

      <div class="part">
        <h3>חלק ד׳ – דקדוק</h3>
        ${l.grammar.map((q, i) => `
          <div class="question">
            <strong>${i + 1}. ${q[0]}</strong>
            <div class="options">
              ${q[1].map((o, j) => `
                <label><input type="radio" name="gram_${i}" value="${j}"> ${o}</label>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="part">
        <h3>חלק ה׳ – Cloze</h3>
        <p><strong>בנק מילים:</strong> ${l.clozeBank.map(w => `<span class="badge">${w}</span>`).join(" ")}</p>
        ${l.cloze.map((q, i) => `
          <div class="question">
            <strong>${i + 1}. ${q[0]}</strong>
            <input type="text" id="cloze_${i}">
          </div>
        `).join("")}
      </div>

      <button onclick="gradeLesson('${l.id}')">בדוק שיעור</button>
      <div id="resultBox"></div>
    </div>
  `;

  scrollTo({ top: 0, behavior: "smooth" });
}

window.gradeLesson = async function(id) {
  try {
    const l = LESSONS.find(x => x.id === id);
    let score = 0;
    let total = 0;

    const parts = {
      vocab: [0, 0],
      reading: [0, 0],
      grammar: [0, 0],
      cloze: [0, 0]
    };

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
        const ans = normalize(document.getElementById(`open_${i}`).value);
        const hit = q.keywords.filter(k => ans.includes(k)).length;
        const pts = hit ? 2 : ans.length > 10 ? 1 : 0;

        score += pts;
        parts.reading[0] += pts;
        fb.push(`שאלה פתוחה ${i + 1}: תשובה טובה תכלול רעיון כמו: ${q.keywords.join(" / ")}.`);
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

    data.lessons = data.lessons || {};
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
      <div class="scoreBox">
        <h3>ציון: ${score}/${total} (${percent}%)</h3>
        <p>
          אוצר מילים: ${parts.vocab[0]}/${parts.vocab[1]} |
          הבנת הנקרא: ${parts.reading[0]}/${parts.reading[1]} |
          דקדוק: ${parts.grammar[0]}/${parts.grammar[1]} |
          Cloze: ${parts.cloze[0]}/${parts.cloze[1]}
        </p>
      </div>

      <h3>משוב</h3>
      ${
        fb.length
          ? `<ul>${fb.map(x => `<li>${x}</li>`).join("")}</ul>`
          : "<p>מעולה! הכול נכון.</p>"
      }
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
      <div class="card">
        <h2>חזרה על מילים שטעיתי בהן</h2>
        ${
          w.length
            ? w.map(x => `<span class="badge">${x}</span>`).join(" ")
            : "<p>אין עדיין מילים לחזרה.</p>"
        }
      </div>
    `;
  } catch (err) {
    showError(err);
  }
}

resetBtn.onclick = async () => {
  if (confirm("לאפס את כל ההתקדמות?")) {
    await saveData({ lessons: {}, wrongWords: [] });
    await renderHome();
  }
};

importBtn.onclick = async () => {
  const oldProgress = JSON.parse(localStorage.getItem(OLD_PROGRESS_KEY) || "{}");
  const oldWrongWords = JSON.parse(localStorage.getItem(OLD_WRONG_KEY) || "[]");

  await saveData({
    lessons: oldProgress,
    wrongWords: oldWrongWords
  });

  alert("ההתקדמות הישנה הועתקה.");
  await renderHome();
};

homeBtn.onclick = renderHome;
reviewBtn.onclick = renderReview;

renderHome();
