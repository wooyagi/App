// Vercel 서버리스 함수: 재료 이름 → 가장 잘 어울리는 이모지 1개 (Groq)
// matchEmoji 사전에 없는 재료(예: 용과)도 AI가 적절한 이모지를 골라줌.

const SYS = [
  "너는 음식·식재료 이름을 받아, 그 재료를 가장 잘 나타내는 이모지 하나만 출력한다.",
  "출력은 이모지 1개뿐. 설명·글자·따옴표·공백 금지.",
  "정확히 맞는 이모지가 없으면 가장 비슷한 음식/식재료 이모지를 고른다. 그래도 없으면 🍽 를 쓴다.",
  "예: 사과→🍎, 용과→🐉, 두리안→🥭, 소고기→🥩, 고등어→🐟, 두부→🍲, 라면→🍜, 우유→🥛",
].join("\n");

const MODELS = [process.env.GROQ_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean);

function firstEmoji(s) {
  const m = (s || "").match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic})*[️]?/u);
  return m ? m[0] : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const key = process.env.GROQ_API_KEY;
  if (!key) { res.status(500).json({ error: "no_api_key" }); return; }
  const name = String((req.body && req.body.name) || "").slice(0, 40).trim();
  if (!name) { res.status(400).json({ error: "no_name" }); return; }

  for (const model of MODELS) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key, "User-Agent": "fridge-app/1.0" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYS }, { role: "user", content: name }],
          temperature: 0,
          max_tokens: 12,
        }),
      });
      if (!r.ok) continue;
      const data = await r.json();
      const emo = firstEmoji(data?.choices?.[0]?.message?.content || "");
      if (emo) { res.status(200).json({ emoji: emo, model }); return; }
    } catch (e) { /* 다음 모델로 */ }
  }
  res.status(200).json({ emoji: "" });
}
