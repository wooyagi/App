// Vercel 서버리스 함수: 요리명들을 받아 유튜브에 실제 영상이 있는지 확인.
// 키 불필요 — 유튜브 검색 결과 페이지를 서버에서 가져와 videoId 존재 여부로 판단.
// 브라우저에서는 CORS로 막히므로 반드시 서버(여기)에서 조회한다.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

async function checkOne(name) {
  const q = encodeURIComponent(String(name || "").trim() + " 레시피");
  const url = `https://www.youtube.com/results?search_query=${q}&hl=ko&gl=KR`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9",
        // EU 동의 인터스티셜 우회 → 바로 결과 HTML을 받도록
        "Cookie": "CONSENT=YES+1; SOCS=CAI",
      },
    });
    if (!r.ok) return { name, ok: true, videoId: "", soft: true }; // 조회 실패 → 보수적으로 통과
    const html = await r.text();
    // 첫 번째 영상 id
    const m = html.match(/"videoId":"([\w-]{11})"/);
    // 광고/셀프 링크가 아닌 실제 검색 결과가 몇 개나 있는지 대략 카운트
    const count = (html.match(/"videoId":"[\w-]{11}"/g) || []).length;
    return { name, ok: !!m && count >= 2, videoId: m ? m[1] : "", count };
  } catch (e) {
    return { name, ok: true, videoId: "", soft: true }; // 네트워크 오류 → 통과
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method_not_allowed" }); return; }
  const names = (req.body && req.body.names) || [];
  const list = Array.isArray(names) ? names.slice(0, 8).map(String) : [];
  if (!list.length) { res.status(200).json({ results: [] }); return; }
  try {
    const results = await Promise.all(list.map(checkOne));
    res.status(200).json({ results });
  } catch (e) {
    res.status(200).json({ results: list.map(name => ({ name, ok: true, videoId: "", soft: true })) });
  }
}
