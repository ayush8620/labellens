// POST /api/scan  { image?: dataURL, text?: string, profile: string[], lang: "English"|"Hindi"|"Hinglish" }
const { gemmaJSON, readBody, parseImage } = require("./_gemma");

const PROFILES = ["diabetic", "high blood pressure", "vegetarian", "vegan", "jain", "nut allergy", "lactose intolerant", "gluten intolerant", "pregnant", "child under 10", "weight loss"];
const LANGS = ["English", "Hindi", "Hinglish"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const b = readBody(req);
    const image = parseImage(b.image);
    const text = String(b.text || "").slice(0, 6000).trim();
    if (!image && !text) return res.status(400).json({ error: "Add a photo of the label or paste its text" });
    const profile = (Array.isArray(b.profile) ? b.profile : []).filter((p) => PROFILES.includes(p));
    const lang = LANGS.includes(b.lang) ? b.lang : "English";

    const prompt = `You are LabelLens, a careful food & personal-care label explainer for Indian shoppers.
${image ? "Read the product label in the attached photo (ingredients, nutrition table, allergen line, veg/non-veg mark, FSSAI info)." : ""}
${text ? `Label text supplied by the user:\n"""${text}"""` : ""}
Shopper profile: ${profile.length ? profile.join(", ") : "none given"}.
Write every human-readable string in ${lang}${lang === "Hinglish" ? " (Hindi in Latin script)" : ""}. Keep JSON keys in English.
Be factual; if something is not visible on the label say so instead of guessing. Not medical advice.
Return ONLY JSON with this exact shape:
{"product":"name or 'Unknown product'","category":"e.g. snack, biscuit, shampoo","readable":true,
"verdict":"good|caution|avoid","score":0-100,"summary":"2 sentence plain-language summary",
"nutrition":[{"name":"Sugar","per100g":"38 g","level":"low|medium|high"}],
"ingredients":[{"name":"as on label","plain":"what it is in simple words","flag":"none|watch|avoid"}],
"allergens":["milk"],"diet":{"veg":true,"vegan":false,"jain":false},
"forYou":[{"profile":"diabetic","status":"ok|caution|avoid","why":"short reason"}],
"tips":["1-3 short healthier-choice tips"]}
Max 12 ingredients (most important first). forYou must cover each profile in the shopper profile.`;

    const { data, model } = await gemmaJSON(prompt, { images: image ? [image] : [], maxOutputTokens: 2500 });
    res.status(200).json({ ...data, model });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || "Something went wrong" });
  }
};
