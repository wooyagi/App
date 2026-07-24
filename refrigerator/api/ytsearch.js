// Vercel 서버리스 함수: 요리명들을 받아 유튜브에서 "요리명이 실제로 들어간 인기 영상"을 찾는다.
// 키 불필요 — 유튜브 검색(관련성) 결과 페이지를 서버에서 파싱한다.
// 조회수순 정렬은 엉뚱한 인기 영상이 1위로 올 수 있어, 관련성 상위 후보 중
// "제목에 요리명이 들어간" 영상만 골라 그중 조회수가 가장 높은 것을 고른다(인기+정확).
// 브라우저에서는 CORS로 막히므로 반드시 서버(여기)에서 조회한다.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36";

function unesc(s) {
  return String(s || "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, "/").replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
}

// "조회수 1.2만회", "123만", "1.2억", "1,234,567회", "1.2M views" → 숫자
function parseViews(t) {
  if (!t) return 0;
  const s = String(t).replace(/조회수|회|views?|,/gi, "").trim();
  let m;
  if ((m = s.match(/([\d.]+)\s*억/))) return Math.round(parseFloat(m[1]) * 1e8);
  if ((m = s.match(/([\d.]+)\s*만/))) return Math.round(parseFloat(m[1]) * 1e4);
  if ((m = s.match(/([\d.]+)\s*천/))) return Math.round(parseFloat(m[1]) * 1e3);
  if ((m = s.match(/([\d.]+)\s*b/i))) return Math.round(parseFloat(m[1]) * 1e9);
  if ((m = s.match(/([\d.]+)\s*m/i))) return Math.round(parseFloat(m[1]) * 1e6);
  if ((m = s.match(/([\d.]+)\s*k/i))) return Math.round(parseFloat(m[1]) * 1e3);
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");

// 검색 결과 HTML → 영상 후보 목록(id·제목·조회수)
function parseCandidates(html, limit) {
  const out = [], seen = new Set();
  const re = /"videoId":"([\w-]{11})"/g;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const id = m[1];
    if (seen.has(id)) continue;
    const seg = html.slice(m.index, m.index + 2500);
    const tm = seg.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/) ||
               seg.match(/"title":\{"simpleText":"((?:[^"\\]|\\.)*)"/);
    if (!tm) continue; // 제목 없는 건 실제 영상 렌더러가 아님(썸네일/광고 등)
    seen.add(id);
    const vm = seg.match(/"viewCountText":\{"simpleText":"((?:[^"\\]|\\.)*)"/) ||
               seg.match(/"shortViewCountText":\{[^}]*?"simpleText":"((?:[^"\\]|\\.)*)"/) ||
               seg.match(/"viewCountText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
    const viewsText = vm ? unesc(vm[1]) : "";
    out.push({ id, title: unesc(tm[1]), viewsText, views: parseViews(viewsText) });
  }
  return out;
}

async function checkOne(name) {
  const dish = String(name || "").trim();
  const q = encodeURIComponent(dish + " 레시피");
  const url = `https://www.youtube.com/results?search_query=${q}&hl=ko&gl=KR`; // 관련성순(기본)
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
    const cands = parseCandidates(html, 15);
    if (!cands.length) return { name, ok: true, videoId: "", soft: true };

    const nn = norm(dish);
    // 제목에 요리명이 실제로 들어간 후보만(정확). 그중 조회수 최상위(인기).
    const matched = cands.filter((c) => norm(c.title).includes(nn));
    if (matched.length) {
      matched.sort((a, b) => b.views - a.views);
      const best = matched[0];
      return { name, ok: true, videoId: best.id, title: best.title, views: best.viewsText, matched: true };
    }
    // 정확히 맞는 영상이 없으면: 엉뚱한 영상을 링크하지 않는다.
    // 레시피 자체는 유지하되(검색 결과는 존재), 특정 영상 대신 검색으로 열도록 videoId 비움.
    return { name, ok: cands.length >= 2, videoId: "", matched: false };
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
    res.status(200).json({ results: list.map((name) => ({ name, ok: true, videoId: "", soft: true })) });
  }
}
