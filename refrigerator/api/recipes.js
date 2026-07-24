// Vercel 서버리스 함수: 브라우저 → 여기 → Groq (무료 LLM)
// Groq 키는 Vercel 환경변수(GROQ_API_KEY)에만 있고 브라우저에 노출되지 않음.

const SYS = [
  "너는 한국 가정식 전문 요리사다. 반드시 한국어(한글)로만 답한다.",
  "요리명·재료·조리 단계를 전부 자연스러운 한국어로 쓴다.",
  "한자(漢字)·중국어·일본어·영어를 절대 쓰지 않는다. 모든 글자는 한글과 숫자, 기본 문장부호로만 쓴다.",
  "괄호 안에 한자나 원어를 덧붙이지 않는다(예: '간장(醬)', '두부(豆腐)' 금지). 외래어도 한글로만 적는다(파스타, 토마토, 치즈, 소스 등).",
  "요리명·재료·조리 단계 모두 초등학생도 이해할 만큼 쉽고 명확한 한국어로 쓴다.",
  "실제로 많이 만들어 먹는 대중적이고 검증된 한국 가정식·자취요리만 추천한다. 새로 지어낸 퓨전은 금지.",
  "출력은 반드시 아래 형태의 JSON 객체 하나만. 설명·마크다운·코드블록 없이 JSON만 출력한다. recipes 배열은 요청한 개수만큼 반드시 채운다.",
  '{"recipes":[{"name":"김치볶음밥","difficulty":"간단","time":"약 10분","servings":"1인분","amounts":["김치 1컵(약 150g)","밥 1공기(약 210g)","계란 1개","식용유 1큰술(15ml)","대파 1/2대"],"use":["김치","밥","계란"],"missing":["식용유"],"steps":["팬에 식용유 1큰술을 두르고 중불에서 김치 1컵을 2분간 볶는다.","밥 1공기를 넣고 3분간 함께 볶는다.","계란 1개로 프라이를 만들어 위에 올려 완성한다."]}]}',
  'difficulty는 "간단","보통","복잡" 중 하나. time은 "약 15분"처럼 쓴다. servings는 "1인분","2인분"처럼 쓴다. use=냉장고에 있는 재료, missing=없어서 사야 하는 재료.',
  "amounts에는 모든 재료의 정확한 계량을 적는다(그램·밀리리터·큰술·작은술·컵·개·대 등. 예: '간장 1큰술(15ml)', '밥 1공기(약 210g)').",
  "steps는 각 단계를 재료의 분량·시간·불세기까지 구체적으로 한 문장씩, 순 한글로 쓴다(예: '중불에서 3분간 볶는다').",
].join("\n");

// 한국어 품질이 좋은 모델을 우선 시도하고, 사용 불가 시 안정 모델로 폴백.
const MODEL_CANDIDATES = [
  process.env.GROQ_MODEL,
  "moonshotai/kimi-k2-instruct",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter(Boolean);

// 한글 텍스트에 섞이면 안 되는 한자(중국어) 비율 측정 → 깨진 응답 걸러내기.
function hanRatio(s) {
  const chars = [...(s || "")];
  if (!chars.length) return 0;
  let han = 0;
  for (const c of chars) {
    const cp = c.codePointAt(0);
    if ((cp >= 0x3400 && cp <= 0x9fff) || (cp >= 0x3040 && cp <= 0x30ff)) han++; // CJK 한자 + 일본어 가나
  }
  return han / chars.length;
}

// 응답에 섞인 한자·일본어 가나를 제거하고, 그로 인해 남는 빈 괄호·군더더기 공백을 정리한다.
function stripCJK(s) {
  return String(s == null ? "" : s)
    .replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g, "")
    .replace(/（\s*）|\(\s*\)|\[\s*\]|【\s*】/g, "")
    .replace(/\s+([,.!?)\]}])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function clean(arr) {
  if (!Array.isArray(arr)) return [];
  const slist = (v) => {
    const a = Array.isArray(v) ? v : (typeof v === "string" && v.trim() ? [v] : []);
    return a.map(x => stripCJK(x)).filter(Boolean);
  };
  const mapped = arr.filter(r => r && typeof r === "object" && stripCJK(r.name)).map(r => ({
    name: stripCJK(r.name),
    difficulty: ["간단", "보통", "복잡"].includes(r.difficulty) ? r.difficulty : "보통",
    time: stripCJK(r.time),
    servings: stripCJK(r.servings),
    amounts: slist(r.amounts),
    use: slist(r.use),
    missing: slist(r.missing),
    steps: slist(r.steps),
  }));
  // 한자·가나가 섞인(깨진) 레시피는 제외. 전부 걸러지면 원본 유지(빈 결과 방지).
  const korean = mapped.filter(r => hanRatio([r.name, ...r.amounts, ...r.use, ...r.missing, ...r.steps].join(" ")) < 0.04);
  return korean.length ? korean : mapped;
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

async function callModel(key, model, prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key, "User-Agent": "fridge-app/1.0" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) return { ok: false, status: r.status, detail: (await r.text()).slice(0, 300) };
  const data = await r.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  return { ok: true, recipes: clean(extract(text)) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const key = process.env.GROQ_API_KEY;
  if (!key) { res.status(500).json({ error: "no_api_key" }); return; }
  const prompt = (req.body && req.body.prompt) || "";
  if (!prompt) { res.status(400).json({ error: "no_prompt" }); return; }

  let last = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const out = await callModel(key, model, prompt);
      if (out.ok && out.recipes.length) { res.status(200).json({ text: JSON.stringify(out.recipes), model }); return; }
      last = out; // 실패 또는 빈 결과 → 다음 후보로
    } catch (e) {
      last = { ok: false, detail: String(e).slice(0, 300) };
    }
  }
  res.status(502).json({ error: "groq_error", detail: last?.detail || "no_result", triedModels: MODEL_CANDIDATES });
}
