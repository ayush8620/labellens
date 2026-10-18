const PROFILES = ["diabetic", "high blood pressure", "vegetarian", "vegan", "jain", "nut allergy", "lactose intolerant", "gluten intolerant", "pregnant", "child under 10", "weight loss"];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let image = null;

$("#profile").innerHTML = PROFILES.map((p) => `<label class="chip"><input type="checkbox" value="${p}">${p}</label>`).join("");

// Shrink photos on the device before upload (faster + stays under API limits).
function loadImage(file) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => {
      const max = 1280, s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => fail(new Error("Could not read that image"));
    img.src = URL.createObjectURL(file);
  });
}
async function setFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  image = await loadImage(file);
  $("#preview").innerHTML = `<img src="${image}" alt="Label preview">`;
  $("#dropText").innerHTML = `<span class="small">Tap to change photo</span>`;
}
const drop = $("#drop");
drop.onclick = () => $("#file").click();
drop.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && $("#file").click();
$("#file").onchange = (e) => setFile(e.target.files[0]);
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); setFile(e.dataTransfer.files[0]); };

$("#sample").onclick = () => {
  image = null; $("#preview").innerHTML = ""; $("#dropText").innerHTML = "📷 Tap to take / upload a photo of the label";
  $("#text").value = "CHOCO CREAM BISCUITS. Ingredients: Refined wheat flour (maida), sugar, edible vegetable oil (palm), cocoa solids (4%), invert sugar syrup, milk solids, raising agents [503(ii), 500(ii)], iodised salt, emulsifiers [322 (soy lecithin), 471], artificial flavours (chocolate, vanilla). Contains wheat, milk and soy. May contain traces of nuts. Nutrition per 100 g: Energy 486 kcal, Protein 6 g, Carbohydrate 70 g, Total sugars 34 g, Fat 20 g, Saturated fat 10 g, Sodium 310 mg. Green dot: vegetarian.";
  document.querySelectorAll("#profile input").forEach((i) => (i.checked = ["diabetic", "nut allergy"].includes(i.value)));
};

const VC = { good: "ok", ok: "ok", caution: "warn", watch: "warn", medium: "warn", avoid: "bad", high: "bad", low: "ok", none: "ok" };
function render(d) {
  const v = VC[d.verdict] || "warn";
  const nut = (d.nutrition || []).map((n) => `<tr><td>${esc(n.name)}</td><td>${esc(n.per100g)}</td><td><span class="badge ${VC[n.level] || ""}">${esc(n.level)}</span></td></tr>`).join("");
  const ing = (d.ingredients || []).map((i) => `<li><b>${esc(i.name)}</b> ${i.flag && i.flag !== "none" ? `<span class="badge ${VC[i.flag]}">${esc(i.flag)}</span>` : ""}<div class="muted small">${esc(i.plain)}</div></li>`).join("");
  const you = (d.forYou || []).map((f) => `<li><span class="badge ${VC[f.status] || ""}">${esc(f.status)}</span> <b>${esc(f.profile)}</b><div class="muted small">${esc(f.why)}</div></li>`).join("");
  const diet = d.diet || {};
  $("#out").innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><div class="muted small">${esc(d.category)}</div><div style="font-size:20px;font-weight:800">${esc(d.product)}</div></div>
      <div style="text-align:right"><div class="${v}" style="font-size:34px;font-weight:900;line-height:1">${esc(d.score)}<span class="small">/100</span></div><span class="badge ${v}">${esc(String(d.verdict || "").toUpperCase())}</span></div>
    </div>
    <p>${esc(d.summary)}</p>
    <div class="chips">${["veg", "vegan", "jain"].map((k) => `<span class="badge ${diet[k] ? "ok" : "bad"}">${diet[k] ? "✓" : "✗"} ${k}</span>`).join("")}
      ${(d.allergens || []).map((a) => `<span class="badge warn">⚠ ${esc(a)}</span>`).join("")}</div>
    ${you ? `<div class="sec"><h3>For you</h3><ul class="list">${you}</ul></div>` : ""}
    ${nut ? `<div class="sec"><h3>Nutrition (per 100 g)</h3><table><tr><th>Nutrient</th><th>Amount</th><th>Level</th></tr>${nut}</table></div>` : ""}
    ${ing ? `<div class="sec"><h3>Ingredients, explained</h3><ul class="list">${ing}</ul></div>` : ""}
    ${(d.tips || []).length ? `<div class="sec"><h3>Tips</h3><ul>${d.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    <p class="muted small">Model: ${esc(d.model)} · AI can make mistakes, always check the pack. Not medical advice.</p>`;
}

$("#go").onclick = async () => {
  const text = $("#text").value.trim();
  $("#error").innerHTML = "";
  if (!image && !text) { $("#error").innerHTML = `<div class="err">Add a photo of the label or paste its text first.</div>`; return; }
  const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Reading label with Gemma 4…`;
  $("#out").innerHTML = `<div class="empty"><span class="spin" style="display:inline-block;border-color:#fff3;border-top-color:var(--accent)"></span><br>Reading the label…</div>`;
  try {
    const profile = [...document.querySelectorAll("#profile input:checked")].map((i) => i.value);
    const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, text, profile, lang: $("#lang").value }) });
    const d = await r.json().catch(() => ({ error: "Server returned an invalid response" }));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    render(d);
  } catch (e) {
    $("#out").innerHTML = `<div class="empty">No report yet.</div>`;
    $("#error").innerHTML = `<div class="err">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = "Explain this label"; }
};
