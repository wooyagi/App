// Vercel 서버리스 함수: 요리명들을 받아 유튜브에서 "조회수 많은 인기 영상"을 찾는다.
// 키 불필요 — 유튜브 검색 결과(조회수순 정렬) 페이지를 서버에서 파싱한다.
// 브라우저에서는 CORS로 막히므로 반드시 서버(여기)에서 조회한다.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";
// 유튜브 검색 필터 토큰: sp=CAMSAhAB → "조회수순" 정렬
const SORT_VIEWS = "CAMSAhAB";

function unesc(s) {
  return String(s || "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, "/").replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
}

async function checkOne(name) {
  const q = encodeURIComponent(String(name || "").trim() + " 레시피");
  const url = `https://www.youtube.com/results?search_query=${q}&hl=ko&gl=KR&sp=${SORT_VIEWS}`;
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Cookie": "CONSENT=YES+1; SOCS=CAI", // EU 동의 인터스티셜 우회
      },
    });
    if (!r.ok) return { name, ok: true, videoId: "", soft: true }; // 실패 → 보수적으로 통과
    const html = await r.text();
    const count = (html.match(/"videoId":"[\w-]{11}"/g) || []).length;
    // 조회수순 정렬이므로 첫 번째 videoRenderer가 가장 인기 있는 영상
    const m = html.match(/"videoRenderer":\{"videoId":"([\w-]{11})"/) || html.match(/"videoId":"([\w-]{11})"/);
    const videoId = m ? m[1] : "";
    let title = "", views = "";
    if (videoId) {
      const i = html.indexOf(videoId);
      const seg = html.slice(i, i + 3000);
      const tm = seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) || seg.match(/"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
      if (tm) title = unesc(tm[1]).slice(0, 100);
      const vm = seg.match(/"viewCountText":\{"simpleText":"((?:[^"\\]|\\.)*)"/) ||
                 seg.match(/"shortViewCountText":\{[^}]*?"simpleText":"((?:[^"\\]|\\.)*)"/) ||
                 seg.match(/"viewCountText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
      if (vm) views = unesc(vm[1]).slice(0, 30);
    }
    return { name, ok: !!videoId && count >= 2, videoId, title, views };
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
