const STORAGE_KEY = "michi-habit-tracker-v1";
const icons = ["☀", "◉", "✿", "♫", "☕", "✎", "♧", "❋"];

const today = localDateKey(new Date());
const dateLine = document.querySelector("#date-line");
const list = document.querySelector("#habit-list");
const template = document.querySelector("#habit-template");
const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const emptyState = document.querySelector("#empty-state");

dateLine.textContent = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric", month: "long", day: "numeric", weekday: "long",
}).format(new Date());

let habits = loadHabits();

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadHabits() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch { /* Ignore invalid saved data and start fresh. */ }
  return [
    { id: crypto.randomUUID(), name: "朝にコップ一杯の水を飲む", icon: icons[0], history: [] },
    { id: crypto.randomUUID(), name: "10分だけ読書する", icon: icons[2], history: [] },
    { id: crypto.randomUUID(), name: "寝る前にストレッチ", icon: icons[6], history: [] },
  ];
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

function getStreak(habit) {
  const completed = new Set(habit.history ?? []);
  let cursor = new Date();
  if (!completed.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function render() {
  list.replaceChildren();
  const done = habits.filter((habit) => habit.history?.includes(today)).length;
  const total = habits.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  document.querySelector("#done-count").textContent = done;
  document.querySelector("#total-count").textContent = total;
  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.querySelector("#progress-ring").style.setProperty("--progress", `${percent * 3.6}deg`);
  document.querySelector("#progress-ring").setAttribute("aria-label", `今日の達成率 ${percent}%`);
  document.querySelector("#summary-message").textContent = total === 0
    ? "新しい習慣を登録してみましょう。"
    : percent === 100
      ? "すべて完了！今日の自分に拍手。"
      : percent > 0
        ? "いい調子。その一歩が積み重なります。"
        : "小さな一歩から始めましょう。";
  emptyState.hidden = total > 0;

  for (const habit of habits) {
    const card = template.content.firstElementChild.cloneNode(true);
    const isDone = habit.history?.includes(today) ?? false;
    card.classList.toggle("is-done", isDone);
    card.querySelector(".habit-info h3").textContent = habit.name;
    card.querySelector(".habit-icon").textContent = habit.icon || icons[0];
    const streak = getStreak(habit);
    card.querySelector(".streak-value").textContent = streak ? `連続 ${streak} 日` : "今日からスタート";
    card.querySelector(".check-button").setAttribute("aria-label", isDone ? `${habit.name}を未完了に戻す` : `${habit.name}を完了にする`);
    card.querySelector(".check-button").addEventListener("click", () => toggleHabit(habit.id));
    card.querySelector(".delete-button").addEventListener("click", () => deleteHabit(habit.id));
    list.append(card);
  }
}

function toggleHabit(id) {
  habits = habits.map((habit) => {
    if (habit.id !== id) return habit;
    const history = new Set(habit.history ?? []);
    history.has(today) ? history.delete(today) : history.add(today);
    return { ...habit, history: [...history].sort() };
  });
  saveHabits();
  render();
}

function deleteHabit(id) {
  const habit = habits.find((item) => item.id === id);
  if (!habit || !window.confirm(`「${habit.name}」を削除しますか？`)) return;
  habits = habits.filter((item) => item.id !== id);
  saveHabits();
  render();
}

function openForm() {
  form.hidden = false;
  emptyState.hidden = true;
  nameInput.focus();
}

document.querySelector("#open-form").addEventListener("click", openForm);
document.querySelector("#empty-add").addEventListener("click", openForm);
document.querySelector("#cancel-form").addEventListener("click", () => {
  form.reset();
  form.hidden = true;
  render();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  habits.push({ id: crypto.randomUUID(), name, icon: icons[habits.length % icons.length], history: [] });
  saveHabits();
  form.reset();
  form.hidden = true;
  render();
});

render();

