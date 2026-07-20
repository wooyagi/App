// Vercel 서버리스 함수: 브라우저 → 여기 → Groq (무료 LLM)
// Groq 키는 Vercel 환경변수(GROQ_API_KEY)에만 있고 브라우저에 노출되지 않음.

const SYS = [
  "너는 한국 가정식 전문 요리사야. 반드시 한국어로만 답한다.",
  "요리명·재료·조리 단계 문장을 전부 자연스러운 한국어로 쓴다. 중국어·영어·한자를 섞지 않는다.",
  "실제로 많이 만들어 먹는 대중적이고 검증된 한국 가정식·자취요리만 추천한다.",
  "출력은 반드시 아래 형태의 JSON 객체 하나. recipes 배열은 요청한 개수만큼 반드시 채운다.",
  '{"recipes":[{"name":"김치볶음밥","difficulty":"간단","time":"약 10분","use":["김치","밥","계란"],"missing":["식용유"],"steps":["팬에 기름을 두르고 김치를 볶는다.","밥을 넣고 함께 볶는다.","계란 프라이를 올려 완성한다."]}]}',
  'difficulty는 "간단","보통","복잡" 중 하나. time은 "약 15분"처럼 쓴다. use=냉장고에 있는 재료, missing=없어서 사야 하는 재료.',
  "steps는 각 단계를 구체적으로(재료 양·순서·불세기 등) 한 문장씩 쓴다.",
].join("\n");

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

function extract(text) {
  let obj;
  try { obj = JSON.parse(text); }
  catch (e) {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    try { obj = JSON.parse(text.slice(a, b + 1)); } catch (_) { return []; }
  }
  if (Array.isArray(obj)) return obj;
  for (const k of ["recipes", "요리", "list", "data"]) if (Array.isArray(obj?.[k])) return obj[k];
  return [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const key = process.env.GROQ_API_KEY;
  if (!key) { res.status(500).json({ error: "no_api_key" }); return; }
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const prompt = (req.body && req.body.prompt) || "";
  if (!prompt) { res.status(400).json({ error: "no_prompt" }); return; }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key, "User-Agent": "fridge-app/1.0" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYS },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: "groq_error", status: r.status, detail: detail.slice(0, 300) });
      return;
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "{}";
    res.status(200).json({ text: JSON.stringify(clean(extract(text))) });
  } catch (e) {
    res.status(500).json({ error: "recipe_failed", detail: String(e).slice(0, 300) });
  }
}
