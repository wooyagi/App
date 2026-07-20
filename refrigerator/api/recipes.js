// Vercel 서버리스 함수: 브라우저 → 여기 → Gemini
// Gemini 키는 Vercel 환경변수(GEMINI_API_KEY)에만 있고 브라우저에 노출되지 않음.

const SYS = [
  "너는 한국 가정식 전문 요리사야. 반드시 한국어로만 답한다.",
  "요리명·재료·조리 단계 문장을 전부 자연스러운 한국어로 쓴다. 중국어·영어·한자를 섞지 않는다.",
  "실제로 많이 만들어 먹는 대중적이고 검증된 한국 가정식·자취요리만 추천한다.",
  "요청한 개수만큼 recipes를 반드시 채운다.",
].join("\n");

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      difficulty: { type: "STRING", enum: ["간단", "보통", "복잡"] },
      time: { type: "STRING" },
      use: { type: "ARRAY", items: { type: "STRING" } },
      missing: { type: "ARRAY", items: { type: "STRING" } },
      steps: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["name", "difficulty", "time", "use", "missing", "steps"],
  },
};

function clean(arr) {
  if (!Array.isArray(arr)) return [];
  const slist = (v) => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean)
    : (typeof v === "string" && v.trim() ? [v.trim()] : []);
  return arr.filter(r => r && typeof r === "object" && String(r.name || "").trim()).map(r => ({
    name: String(r.name).trim(),
    difficulty: ["간단", "보통", "복잡"].includes(r.difficulty) ? r.difficulty : "보통",
    time: String(r.time || "").trim(),
    use: slist(r.use),
    missing: slist(r.missing),
    steps: slist(r.steps),
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const key = process.env.GEMINI_API_KEY;
  if (!key) { res.status(500).json({ error: "no_api_key" }); return; }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = (req.body && req.body.prompt) || "";
  if (!prompt) { res.status(400).json({ error: "no_prompt" }); return; }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const payload = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  };

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: "gemini_error", status: r.status, detail: detail.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "[]";
    let arr;
    try { arr = JSON.parse(text); }
    catch (e) {
      const a = text.indexOf("["), b = text.lastIndexOf("]");
      arr = (a !== -1 && b > a) ? JSON.parse(text.slice(a, b + 1)) : [];
    }
    res.status(200).json({ text: JSON.stringify(clean(arr)) });
  } catch (e) {
    res.status(500).json({ error: "recipe_failed", detail: String(e).slice(0, 300) });
  }
}
