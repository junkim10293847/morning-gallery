// 목소리 비교 견본: 같은 대본을 여러 목소리로 (새 고급 연출 적용)
import fs from 'fs';
const KEY = process.env.GEMINI_KEY; fs.mkdirSync('out', {recursive: true});
const KO = '당신은 고급 미술 다큐멘터리와 미술관 오디오 가이드의 내레이터입니다. 깊고 울림 있는 목소리, 또렷한 발음, 품위 있는 절제. 서두르지 않되 늘어지지 않게, 문장 사이 쉼은 짧게 읽어 주세요.\n번호별 연출 지시 (따르되 소리 내어 읽지 마세요):\n[1] 비밀을 꺼내듯 살짝 낮고 흥미롭게, 질문 끝은 여운 있게\n[2] 따뜻하고 품위 있게, 담담하고 또렷하게\n[3] 한 박자 쉬고, 놀라운 사실을 낮고 힘 있게 또박또박\n[4] 부드럽고 여운 있게, 미소 띤 따뜻한 목소리로\n\n대괄호 번호는 읽지 말고, 번호가 바뀔 때마다 1초 쉬어 주세요:\n\n[1] 200년 전 이 그림 속에, 아무도 몰랐던 실수가 숨어 있습니다. 찾을 수 있을까요?\n\n[2] 조선 최고의 풍속화가 김홍도의 「씨름」. 둥글게 둘러앉은 구경꾼들 사이로, 두 장사가 맞붙었습니다.\n\n[3] 그런데 오른쪽 아래, 뒤로 기대앉은 사람의 손을 보세요. 엄지가 반대쪽에 그려져 있습니다.\n\n[4] 천재 화가의 작은 실수일까요, 아니면 일부러 숨긴 장난일까요? 좋은 아침 되세요.';
const EN = 'You are the narrator of a premium art documentary and museum audio guide: rich, resonant, refined voice, crisp diction, elegant restraint. Measured but never sluggish.\nDirector\'s notes (follow, never read aloud):\n[1] intriguing and slightly hushed, as if sharing a secret\n[2] warm, refined and clear\n[3] after a brief beat, reveal it with low, confident emphasis\n[4] soft and warm, with a gentle smile in the voice\n\nDo not read the numbers. Pause 1 second between parts:\n\n[1] Hidden in this 200-year-old painting is a mistake no one noticed for centuries. Can you find it?\n\n[2] This is Ssireum by Kim Hong-do, the great painter of everyday Joseon life. A ring of spectators, two wrestlers locked together.\n\n[3] But look at the man leaning back in the bottom right corner. His thumb is on the wrong side.\n\n[4] A genius\'s slip, or a playful secret? Have a beautiful day.';
const JOBS = (process.env.VOICES || 'ko:Aoede,ko:Algieba,en:Charon,en:Algieba').split(',').map(v => { const [l, n] = v.split(':'); return [l, n, l === 'en' ? EN : KO]; });
const wav = (b64, rate) => { const pcm = Buffer.from(b64, 'base64'), h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
let i = 0;
for (const [lang, voice, text] of JOBS) {
  i++; let done = false;
  for (const model of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']) {
    for (let t = 0; t < 4 && !done; t++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {method: 'POST', headers: {'content-type': 'application/json', 'x-goog-api-key': KEY}, body: JSON.stringify({contents: [{parts: [{text}]}], generationConfig: {responseModalities: ['AUDIO'], speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: voice}}}}})});
      const j = await r.json().catch(() => ({}));
      const d = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (d) { const rate = +(/rate=(\d+)/.exec(d.mimeType || '') || [0, 24000])[1]; fs.writeFileSync(`out/${i}_${lang}_${voice}.wav`, wav(d.data, rate)); console.log('✅', lang, voice, model); done = true; break; }
      const m = j.error?.message || r.status; console.log('⚠', lang, voice, model, String(m).slice(0, 300));
      if (/per ?day|PerDay/i.test(m)) break;
      await new Promise(res => setTimeout(res, 30000));
    }
    if (done) break;
  }
  await new Promise(res => setTimeout(res, 21000));
}
