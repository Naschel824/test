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

function setDataStatus(message) {
  document.querySelector("#data-status").textContent = message;
}

function downloadBeans() {
  const backup = {
    format: "mame-coffee-log",
    version: 1,
    exportedAt: new Date().toISOString(),
    beans,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mame-coffee-log-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setDataStatus(`記録 ${beans.length} 件をJSONでダウンロードしました。`);
}

function validBackupBean(bean) {
  return bean && typeof bean === "object" && !Array.isArray(bean)
    && typeof bean.id === "string"
    && typeof bean.name === "string" && bean.name.trim().length > 0
    && typeof bean.grams === "number" && Number.isFinite(bean.grams) && bean.grams > 0
    && typeof bean.price === "number" && Number.isFinite(bean.price) && bean.price > 0
    && Array.isArray(bean.countries) && bean.countries.length <= 3
    && bean.countries.every((country) => typeof country === "string")
    && typeof bean.rating === "number" && Number.isFinite(bean.rating) && bean.rating >= 0.5 && bean.rating <= 5
    && typeof bean.createdAt === "number" && Number.isFinite(bean.createdAt)
    && ["store", "roast", "note"].every((key) => bean[key] === undefined || typeof bean[key] === "string");
}

async function uploadBeans(file) {
  const backup = JSON.parse(await file.text());
  if (!backup || backup.format !== "mame-coffee-log" || backup.version !== 1
      || !Array.isArray(backup.beans) || !backup.beans.every(validBackupBean)) {
    throw new Error("このアプリのバックアップJSONではないか、データ形式が正しくありません。");
  }

  const imported = backup.beans.map((bean) => ({
    ...bean,
    store: bean.store ?? "",
    roast: bean.roast ?? "",
    note: bean.note ?? "",
  }));
  const message = `現在の記録 ${beans.length} 件を、ファイル内の ${imported.length} 件で置き換えます。続けますか？`;
  if (!window.confirm(message)) {
    setDataStatus("JSONの読み込みをキャンセルしました。");
    return;
  }

  const previousBeans = beans;
  beans = imported;
  try {
    saveBeans();
  } catch {
    beans = previousBeans;
    throw new Error("ブラウザに保存できませんでした。空き容量を確認してください。");
  }
  searchInput.value = "";
  sortSelect.value = "newest";
  render();
  setDataStatus(`記録 ${beans.length} 件を読み込みました。`);
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
  const rating = Number(form.elements.rating.value || 5);
  form.querySelector(".rating-hint").textContent = `${rating} / 5`;
}

function formatStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - Math.ceil(rating);
  return `${"★".repeat(full)}${half ? "½" : ""}${"☆".repeat(empty)}`;
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
    card.querySelector(".card-stars").textContent = formatStars(bean.rating);
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
  paintStars();
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

document.querySelector("#download-data").addEventListener("click", downloadBeans);
const uploadFile = document.querySelector("#upload-file");
document.querySelector("#upload-data").addEventListener("click", () => uploadFile.click());
uploadFile.addEventListener("change", async () => {
  const file = uploadFile.files?.[0];
  if (!file) return;
  try {
    await uploadBeans(file);
  } catch (error) {
    setDataStatus(error instanceof Error ? error.message : "JSONを読み込めませんでした。");
  } finally {
    uploadFile.value = "";
  }
});

document.querySelector("#open-form").addEventListener("click", showForm);
document.querySelector("#empty-add").addEventListener("click", showForm);
document.querySelector("#close-form").addEventListener("click", closeForm);
document.querySelector("#cancel-form").addEventListener("click", closeForm);
searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
gramsInput.addEventListener("input", updateCostPreview);
priceInput.addEventListener("input", updateCostPreview);
form.elements.rating.addEventListener("input", paintStars);
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

