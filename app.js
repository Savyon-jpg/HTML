const mainArea = document.getElementById("mainArea");
const lessonList = document.getElementById("lessonList");

function renderLessonList() {
  lessonList.innerHTML = "";

  LESSONS.forEach((lesson, index) => {
    const btn = document.createElement("button");
    btn.className = "lesson-btn";
    btn.textContent = `${index + 1}. ${lesson.title}`;
    btn.onclick = () => renderLesson(lesson);
    lessonList.appendChild(btn);
  });
}

function renderHome() {
  mainArea.innerHTML = `
    <h2>ברוך הבא</h2>
    <p>בחר שיעור מהרשימה בצד ימין.</p>
  `;
}

function renderLesson(lesson) {
  let html = `
    <h2>${lesson.title}</h2>
    <p><strong>${lesson.unit || ""}</strong></p>

    <h3>אוצר מילים</h3>
    <ul>
      ${lesson.vocabulary.map(v => `<li><strong>${v[0]}</strong> — ${v[1]}</li>`).join("")}
    </ul>

    <h3>טקסט</h3>
    <div class="reading">${lesson.reading}</div>

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
          <p>${i + 1}. ${q[0]}</p>
          <input id="cloze${i}" type="text">
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

function checkLesson(id) {
  const lesson = LESSONS.find(l => l.id === id);
  let score = 0;
  let total = 0;

  lesson.comprehension.forEach((q, i) => {
    total++;
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (checked && Number(checked.value) === q[2]) score++;
  });

  if (lesson.grammar) {
    lesson.grammar.forEach((q, i) => {
      total++;
      const checked = document.querySelector(`input[name="g${i}"]:checked`);
      if (checked && Number(checked.value) === q[2]) score++;
    });
  }

  if (lesson.cloze) {
    lesson.cloze.forEach((q, i) => {
      total++;
      const answer = document.getElementById(`cloze${i}`).value.trim();
      if (answer === q[1]) score++;
    });
  }

  const percent = Math.round((score / total) * 100);

  document.getElementById("resultBox").innerHTML = `
    <h3>ציון: ${score}/${total} — ${percent}%</h3>
  `;
}

document.getElementById("homeBtn").onclick = renderHome;

renderLessonList();
renderHome();
