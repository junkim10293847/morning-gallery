// 서버(깃허브 액션)에서 모바일 앱을 그대로 열어 "다음 편 모두 만들기"를 실행하고, 완성 영상을 파일로 꺼냅니다.
import {chromium} from 'playwright';
import fs from 'node:fs';
const KEY = process.env.GEMINI_KEY, TOKEN = process.env.GIST_TOKEN, REPO = process.env.REPO || 'junkim10293847/morning-gallery';
const BASE = process.env.BASE_URL || `https://${REPO.split('/')[0]}.github.io/${REPO.split('/')[1]}/`;
fs.mkdirSync('out', {recursive: true});
const report = [];
const log = s => { console.log(s); report.push(s); };
if (!KEY || !TOKEN) { log('❌ 비밀값(GEMINI_KEY, GIST_TOKEN)이 없습니다. 저장소 Settings → Secrets → Actions 에 등록하세요.'); fs.writeFileSync('out/report.txt', report.join('\n')); process.exit(1); }
const kst = new Date(Date.now() + 9 * 3600e3), today = kst.toISOString().slice(0, 10);
const tag = 'v-' + today; fs.writeFileSync('out/tag.txt', tag);
const browser = await chromium.launch({args: ['--autoplay-policy=no-user-gesture-required']});
const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
if (process.env.MOCK_SETUP) { const m = await import(process.env.MOCK_SETUP); await m.default(ctx); }   // 로컬 시험용
const page = await ctx.newPage();
page.on('pageerror', e => console.log('page error:', e.message));
page.on('dialog', d => d.accept());
await page.addInitScript(([k, t]) => {
  try { const s = JSON.parse(localStorage.getItem('mg-settings') || '{}'); Object.assign(s, {engine: 'gemini', textKey: k, ghToken: t, model: ''}); localStorage.setItem('mg-settings', JSON.stringify(s)); } catch (e) {}
}, [KEY, TOKEN]);
await page.goto(BASE + '?server=1', {waitUntil: 'load'});
await page.waitForFunction(() => typeof EPS !== 'undefined' && document.getElementById('ver'), null, {timeout: 60000});
await page.waitForTimeout(8000);                       // 동기화(정책서·일정·원고 받기) + 보낸 일정 반영
await page.evaluate(() => syncNow && syncNow());
await page.waitForTimeout(4000);
const list = await page.evaluate(today => {
  const pick = lang => EPS.filter(e => (e.lang || 'ko') === lang && e.date > today && !e.videoUrl && !e.yt).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 2);
  return [...pick('ko'), ...pick('en')].map(e => ({id: e.id, date: e.date, lang: e.lang || 'ko', topic: (e.topic || '').split(' — ')[0]}));
}, today);
log(`[${today}] 만들 편 ${list.length}개: ` + list.map(e => `${e.date.slice(5)} ${e.lang === 'en' ? 'EN' : '한글'} ${e.topic}`).join(', '));
for (const e of list) {
  const t0 = Date.now();
  await page.evaluate(id => openEp(id), e.id);
  const ok = await page.evaluate(() => makeAll());
  const msg = await page.evaluate(() => document.getElementById('allMsg').textContent);
  const qa = await page.evaluate(() => document.getElementById('qaBox').innerText || '');
  if (ok) {
    const b64 = await page.evaluate(async () => { const b = await getBlob(CUR.videoKey); const a = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); });
    const file = `${e.date}_${e.lang}_${e.id}.mp4`;
    fs.writeFileSync('out/' + file, Buffer.from(b64, 'base64'));
    const url = `https://github.com/${REPO}/releases/download/${tag}/${file}`;
    await page.evaluate(([id, url, qa]) => { const ep = EPS.find(x => x.id === id); ep.videoUrl = url; ep.serverAt = Date.now(); ep.serverMsg = qa; return putEp(ep); }, [e.id, url, qa.slice(0, 600)]);
    log(`✅ ${e.date.slice(5)} ${e.lang === 'en' ? 'EN' : '한글'} ${e.topic} (${Math.round((Date.now() - t0) / 1000)}초) ${qa.replace(/\n/g, ' / ').slice(0, 200)}`);
  } else { log(`⚠ ${e.date.slice(5)} ${e.lang === 'en' ? 'EN' : '한글'} ${e.topic}: ${msg.slice(0, 160)}`); await page.evaluate(([id, m]) => { const ep = EPS.find(x => x.id === id); ep.serverMsg = '⚠ 서버: ' + m; ep.serverAt = Date.now(); return putEp(ep); }, [e.id, msg.slice(0, 300)]); }
}
await page.evaluate(() => syncNow());
await page.waitForTimeout(6000);
fs.writeFileSync('out/report.txt', report.join('\n'));
await browser.close();
