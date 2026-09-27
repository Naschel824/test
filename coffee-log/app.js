const STORAGE_KEY = "mame-coffee-log-v1";
const form = document.querySelector("#bean-form");
const list = document.querySelector("#bean-list");
const template = document.querySelector("#bean-template");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const gramsInput = form.elements.grams;
const priceInput = form.elements.price;
let beans = loadBeans();

function loadBeans() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveBeans() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(beans));
}

function costPerGram(bean) {
  return Number(bean.price) / Number(bean.grams);
}

function formatCost(value) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(value);
}

function countriesFrom(value) {
  return [...new Set(value.split(/[、,，]/).map((country) => country.trim()).filter(Boolean))];
}

function paintStars() {
  const rating = Number(form.querySelector('input[name="rating"]:checked')?.value ?? 5);
  form.querySelectorAll(".stars label").forEach((label, index) => {
    label.classList.toggle("is-selected", index < rating);
  });
  form.querySelector(".rating-hint").textContent = `${rating} / 5`;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("ja-JP");
  const visible = beans.filter((bean) => [bean.name, bean.store, ...(bean.countries ?? []), bean.roast, bean.note]
    .join(" ").toLocaleLowerCase("ja-JP").includes(query));

  if (sortSelect.value === "rating") visible.sort((a, b) => b.rating - a.rating || b.createdAt - a.createdAt);
  if (sortSelect.value === "cost") visible.sort((a, b) => costPerGram(a) - costPerGram(b) || b.createdAt - a.createdAt);
  if (sortSelect.value === "newest") visible.sort((a, b) => b.createdAt - a.createdAt);

  list.replaceChildren();
  document.querySelector("#bean-count").textContent = beans.length;
  const average = beans.length ? beans.reduce((sum, bean) => sum + costPerGram(bean), 0) / beans.length : null;
  document.querySelector("#average-cost").textContent = average === null ? "—" : formatCost(average);

  for (const bean of visible) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".bean-name").textContent = bean.name;
    card.querySelector(".roast-pill").textContent = bean.roast || "焙煎度未設定";
    card.querySelector(".card-stars").textContent = `${"★".repeat(bean.rating)}${"☆".repeat(5 - bean.rating)}`;
    card.querySelector(".card-stars").setAttribute("aria-label", `評価 ${bean.rating} / 5`);
    card.querySelector(".bean-store").textContent = bean.store || "購入店舗未設定";
    card.querySelector(".meta-separator").hidden = !(bean.countries?.length);
    card.querySelector(".bean-countries").textContent = (bean.countries ?? []).join("・") || "生産国未設定";
    card.querySelector(".bean-note").textContent = bean.note;
    card.querySelector(".bean-amount").textContent = `${bean.grams} g`;
    card.querySelector(".bean-price").textContent = `${new Intl.NumberFormat("ja-JP").format(bean.price)} 円`;
    card.querySelector(".bean-cost").textContent = `${formatCost(costPerGram(bean))} 円 / g`;
    card.querySelector(".delete-button").setAttribute("aria-label", `「${bean.name}」の記録を削除`);
    card.querySelector(".delete-button").addEventListener("click", () => deleteBean(bean.id));
    list.append(card);
  }

  const empty = document.querySelector("#empty-state");
  const noResults = beans.length > 0 && visible.length === 0;
  empty.hidden = visible.length > 0;
  document.querySelector("#empty-title").textContent = noResults ? "見つかりませんでした" : "最初の一杯を記録しましょう";
  document.querySelector("#empty-copy").textContent = noResults ? "検索ワードを変えてみてください。" : "飲んだ豆の名前や味の印象を、あとから見返せるように。";
  document.querySelector("#empty-add").hidden = noResults;
}

function showForm() {
  form.hidden = false;
  document.querySelector("#empty-state").hidden = true;
  form.elements.name.focus();
}

function closeForm() {
  form.reset();
  form.hidden = true;
  updateCostPreview();
  render();
}

function updateCostPreview() {
  const grams = Number(gramsInput.value);
  const price = Number(priceInput.value);
  const value = grams > 0 && price > 0 ? `${formatCost(price / grams)} 円 / g` : "— 円 / g";
  document.querySelector("#cost-preview strong").textContent = value.replace(" 円 / g", "");
}

function deleteBean(id) {
  const bean = beans.find((item) => item.id === id);
  if (!bean || !window.confirm(`「${bean.name}」の記録を削除しますか？`)) return;
  beans = beans.filter((item) => item.id !== id);
  saveBeans();
  render();
}

document.querySelector("#open-form").addEventListener("click", showForm);
document.querySelector("#empty-add").addEventListener("click", showForm);
document.querySelector("#close-form").addEventListener("click", closeForm);
document.querySelector("#cancel-form").addEventListener("click", closeForm);
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
gramsInput.addEventListener("input", updateCostPreview);
priceInput.addEventListener("input", updateCostPreview);
form.querySelectorAll('input[name="rating"]').forEach((input) => input.addEventListener("change", paintStars));
form.elements.countries.addEventListener("input", () => form.elements.countries.setCustomValidity(""));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") ?? "").trim();
  const grams = Number(data.get("grams"));
  const price = Number(data.get("price"));
  const countries = countriesFrom(String(data.get("countries") ?? ""));
  if (countries.length > 3) {
    form.elements.countries.setCustomValidity("生産国は3つまで入力できます。");
    form.elements.countries.reportValidity();
    return;
  }
  if (!name || !Number.isFinite(grams) || grams <= 0 || !Number.isFinite(price) || price <= 0) return;

  beans.push({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    store: String(data.get("store") ?? "").trim(),
    grams,
    price,
    countries,
    roast: String(data.get("roast") ?? ""),
    rating: Number(data.get("rating") ?? 5),
    note: String(data.get("note") ?? "").trim(),
    createdAt: Date.now(),
  });
  saveBeans();
  searchInput.value = "";
  sortSelect.value = "newest";
  closeForm();
});

updateCostPreview();
paintStars();
render();

