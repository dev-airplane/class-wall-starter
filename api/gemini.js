// ===================================================
// Gemini에게 물어보는 서버 코드가 들어올 자리 (아직 비어 있습니다)
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고, 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 함수로 처리합니다.
//
// 이 파일의 규칙
//   api 폴더 안의 파일은 Vercel에서 자동으로 서버 주소가 됩니다.
//   이 파일은 /api/gemini 주소가 됩니다.
//   API 키는 코드에 적지 말고 Vercel 환경변수에 넣습니다. (process.env 로 꺼내 씁니다)
// ===================================================

const MODEL = "gemini-3.5-flash-lite";
const TEACHER_UID = process.env.TEACHER_UID;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 사용할 수 있습니다." });
  }

  if (!process.env.GEMINI_API_KEY || !process.env.FIREBASE_WEB_API_KEY || !TEACHER_UID) {
    return res.status(500).json({ error: "Vercel 환경 변수가 설정되지 않았습니다." });
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (text.length === 0 || text.length > 60) {
    return res.status(400).json({ error: "메모는 1자 이상 60자 이하여야 합니다." });
  }

  const idToken = req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!idToken) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  // Firebase ID 토큰으로 실제 로그인 사용자를 확인합니다.
  const accountResponse = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" +
      encodeURIComponent(process.env.FIREBASE_WEB_API_KEY),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: idToken })
    }
  );

  if (!accountResponse.ok) {
    return res.status(401).json({ error: "로그인을 확인하지 못했습니다." });
  }

  const account = await accountResponse.json();
  if (account.users?.[0]?.localId !== TEACHER_UID) {
    return res.status(403).json({ error: "교사만 AI 코멘트를 만들 수 있습니다." });
  }

  // Gemini에는 메모 본문만 보내며 UID, 이메일 등 식별 정보는 보내지 않습니다.
  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "당신은 교사가 담벼락에 붙일 짧고 따뜻한 코멘트를 돕습니다. 한국어 한두 문장으로 답하세요. 메모의 개인정보를 추측하지 말고, 평가·비난·의료 조언·위험한 지시는 하지 마세요."
          }]
        },
        contents: [{
          role: "user",
          parts: [{ text: "메모:\n" + text }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 120
        }
      })
    }
  );

  if (!geminiResponse.ok) {
    let message = "응답 내용을 읽지 못했습니다.";
    try {
      const errorBody = await geminiResponse.json();
      message = errorBody.error?.message || message;
    } catch (error) {
      console.error("Gemini API 오류 내용을 읽지 못했습니다.", error);
    }

    console.error("Gemini API 오류", geminiResponse.status, message);
    return res.status(502).json({
      error: "Gemini API 오류 (HTTP " + geminiResponse.status + ")입니다. Vercel Logs를 확인해 주세요."
    });
  }

  const gemini = await geminiResponse.json();
  const comment = gemini.candidates?.[0]?.content?.parts
    ?.map(function (part) { return part.text || ""; })
    .join("")
    .trim()
    .slice(0, 300);

  if (!comment) {
    return res.status(502).json({ error: "Gemini API 응답에 코멘트가 없습니다." });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ comment: comment });
}
