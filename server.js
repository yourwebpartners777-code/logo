import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'dr-logo.sqlite');
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 3001);
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';
const OPENAI_API_BASE_URL = (process.env.OPENAI_API_BASE_URL || 'https://api.openai.com')
  .replace(/\/+$/, '');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

await fs.mkdir(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    child_name TEXT,
    child_age TEXT,
    child_gender TEXT,
    language TEXT NOT NULL DEFAULT 'ru',
    email_reports_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const sendJson = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const readBody = async (req, maxBytes = 2 * 1024 * 1024) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > maxBytes) {
      throw new Error('Request body is too large');
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

const readJson = async (req) => {
  const body = await readBody(req);
  return JSON.parse(body.toString('utf8') || '{}');
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex'),
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const safeEqual = (a, b) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const getRequestOrigin = (req) => {
  const origin = req.headers.origin;

  if (origin) {
    return origin;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'http';

  return host ? `${proto}://${host}` : APP_ORIGIN;
};

const publicUser = (row) => ({
  email: row.email,
  childName: row.child_name || '',
  childAge: row.child_age || '4',
  childGender: row.child_gender || 'male',
});

const publicSettings = (row) => ({
  language: row.language || 'ru',
  emailReportsEnabled: Boolean(row.email_reports_enabled),
});

const hasProfile = (row) => Boolean(row.child_name && row.child_age && row.child_gender);

const createSession = (userId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
};

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : '';
};

const getSessionUser = (req) => {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const row = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `).get(token, Date.now());

  return row || null;
};

const requireSessionUser = (req, res) => {
  const user = getSessionUser(req);

  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }

  return user;
};

const authResponse = (user, token) => ({
  token,
  user: publicUser(user),
  settings: publicSettings(user),
  hasProfile: hasProfile(user),
});

const handleAuthLogin = async (req, res) => {
  const payload = await readJson(req);
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!email || !password) {
    sendJson(res, 400, { error: 'Email and password are required' });
    return;
  }

  if (password.length < 6) {
    sendJson(res, 400, { error: 'Password must contain at least 6 characters' });
    return;
  }

  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (existingUser) {
    const { hash } = hashPassword(password, existingUser.password_salt);

    if (!safeEqual(hash, existingUser.password_hash)) {
      sendJson(res, 401, { error: 'Invalid email or password' });
      return;
    }

    sendJson(res, 200, authResponse(existingUser, createSession(existingUser.id)));
    return;
  }

  const { salt, hash } = hashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (email, password_salt, password_hash)
    VALUES (?, ?, ?)
  `).run(email, salt, hash);
  const createdUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

  sendJson(res, 201, authResponse(createdUser, createSession(createdUser.id)));
};

const buildPasswordResetEmail = ({ resetUrl }) => {
  const text = [
    'Вы запросили восстановление пароля Dr. Logo.',
    'Чтобы задать новый пароль, откройте ссылку:',
    resetUrl,
    '',
    'Ссылка действует 1 час. Если это были не вы, просто проигнорируйте письмо.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h1 style="margin:0 0 16px;color:#2563eb;">Восстановление пароля Dr. Logo</h1>
      <p>Чтобы задать новый пароль, нажмите кнопку ниже.</p>
      <p>
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:14px;">
          Восстановить пароль
        </a>
      </p>
      <p style="color:#64748b;font-size:13px;">Ссылка действует 1 час. Если это были не вы, просто проигнорируйте письмо.</p>
    </div>
  `;

  return { subject: 'Восстановление пароля Dr. Logo', text, html };
};

const handlePasswordResetRequest = async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    sendJson(res, 503, { error: 'Email sending is not configured' });
    return;
  }

  const payload = await readJson(req);
  const email = String(payload.email || '').trim().toLowerCase();

  if (!email) {
    sendJson(res, 400, { error: 'Email is required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (user) {
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ? OR used_at IS NOT NULL').run(user.id, Date.now());

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;

    db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, user.id, expiresAt);

    const resetUrl = new URL('/', getRequestOrigin(req));
    resetUrl.searchParams.set('resetToken', token);
    resetUrl.searchParams.set('email', email);

    await sendReportEmail({
      to: email,
      ...buildPasswordResetEmail({ resetUrl: resetUrl.toString() }),
    });
  }

  sendJson(res, 200, { ok: true });
};

const handlePasswordResetConfirm = async (req, res) => {
  const payload = await readJson(req);
  const email = String(payload.email || '').trim().toLowerCase();
  const token = String(payload.token || '').trim();
  const password = String(payload.password || '');

  if (!email || !token || !password) {
    sendJson(res, 400, { error: 'Email, token and password are required' });
    return;
  }

  if (password.length < 6) {
    sendJson(res, 400, { error: 'Password must contain at least 6 characters' });
    return;
  }

  const tokenRow = db.prepare(`
    SELECT password_reset_tokens.*, users.email
    FROM password_reset_tokens
    JOIN users ON users.id = password_reset_tokens.user_id
    WHERE password_reset_tokens.token_hash = ?
  `).get(hashToken(token));

  if (!tokenRow || tokenRow.email !== email || tokenRow.used_at || tokenRow.expires_at <= Date.now()) {
    sendJson(res, 400, { error: 'Password reset link is invalid or expired' });
    return;
  }

  const { salt, hash } = hashPassword(password);

  db.prepare(`
    UPDATE users
    SET password_salt = ?,
        password_hash = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(salt, hash, tokenRow.user_id);

  db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ?').run(tokenRow.token_hash);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(tokenRow.user_id);

  sendJson(res, 200, { ok: true });
};

const handleGetProfile = (req, res) => {
  const user = requireSessionUser(req, res);

  if (!user) {
    return;
  }

  sendJson(res, 200, {
    user: publicUser(user),
    settings: publicSettings(user),
    hasProfile: hasProfile(user),
  });
};

const normalizeGender = (gender) => ['male', 'female', 'other'].includes(gender) ? gender : 'male';
const normalizeLanguage = (language) => ['ru', 'uk'].includes(language) ? language : 'ru';

const handleSaveProfile = async (req, res) => {
  const user = requireSessionUser(req, res);

  if (!user) {
    return;
  }

  const payload = await readJson(req);
  const nextUser = payload.user || {};
  const nextSettings = payload.settings || {};
  const nextEmail = String(nextUser.email || user.email).trim().toLowerCase();
  const nextPassword = String(nextUser.password || '');

  if (!nextEmail) {
    sendJson(res, 400, { error: 'Email is required' });
    return;
  }

  if (nextPassword && nextPassword.length < 6) {
    sendJson(res, 400, { error: 'Password must contain at least 6 characters' });
    return;
  }

  const passwordFields = nextPassword ? hashPassword(nextPassword) : null;

  try {
    db.prepare(`
      UPDATE users
      SET email = ?,
          password_salt = COALESCE(?, password_salt),
          password_hash = COALESCE(?, password_hash),
          child_name = ?,
          child_age = ?,
          child_gender = ?,
          language = ?,
          email_reports_enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nextEmail,
      passwordFields?.salt ?? null,
      passwordFields?.hash ?? null,
      String(nextUser.childName || user.child_name || '').trim(),
      String(nextUser.childAge || user.child_age || '4'),
      normalizeGender(nextUser.childGender || user.child_gender),
      normalizeLanguage(nextSettings.language || user.language),
      nextSettings.emailReportsEnabled === false ? 0 : 1,
      user.id,
    );
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      sendJson(res, 409, { error: 'Email is already used' });
      return;
    }

    throw error;
  }

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  sendJson(res, 200, {
    user: publicUser(updatedUser),
    settings: publicSettings(updatedUser),
    hasProfile: hasProfile(updatedUser),
  });
};

const handleLogout = (req, res) => {
  const token = getBearerToken(req);

  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  sendJson(res, 200, { ok: true });
};

const handleOpenAiRealtimeCall = async (req, res) => {
  if (!requireSessionUser(req, res)) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    sendJson(res, 500, { error: 'OPENAI_API_KEY is not configured on backend' });
    return;
  }

  const body = await readBody(req);
  const upstreamResponse = await fetch(`${OPENAI_API_BASE_URL}/v1/realtime/calls`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': req.headers['content-type'] || 'application/octet-stream',
    },
    body,
  });

  res.writeHead(upstreamResponse.status, {
    'content-type': upstreamResponse.headers.get('content-type') || 'text/plain; charset=utf-8',
  });
  res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
};

const handleDashboardGreetingAudio = async (req, res) => {
  if (!requireSessionUser(req, res)) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    sendJson(res, 500, { error: 'OPENAI_API_KEY is not configured on backend' });
    return;
  }

  const payload = await readJson(req);
  const text = String(payload.text || '').trim();
  const instructions = String(payload.instructions || '').trim()
    || 'Speak warmly and clearly to a child. Read the input exactly. Do not add any words.';

  if (!text) {
    sendJson(res, 400, { error: 'Greeting text is required' });
    return;
  }

  const upstreamResponse = await fetch(`${OPENAI_API_BASE_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: text,
      response_format: 'mp3',
      instructions,
    }),
  });

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text();
    sendJson(res, upstreamResponse.status, { error: errorText || 'Failed to create greeting audio' });
    return;
  }

  res.writeHead(200, {
    'content-type': 'audio/mpeg',
    'cache-control': 'no-store',
  });
  res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatTranscript = (transcript = [], language = 'ru') => {
  const childLabel = language === 'uk' ? 'Дитина' : 'Ребенок';

  return transcript
  .map((item) => `${item.speaker === 'user' ? childLabel : 'Dr. Logo'}: ${item.text}`)
  .join('\n');
};

const trimReportText = (value, maxLength = 180) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
};

const getReportTranscriptParts = (transcript = []) => ({
  childTurns: transcript.filter((item) => item?.speaker === 'user' && String(item.text || '').trim()),
  modelTurns: transcript.filter((item) => item?.speaker === 'model' && String(item.text || '').trim()),
});

const detectReportTopics = (transcript = [], language = 'ru') => {
  const allText = transcript.map((item) => item.text || '').join(' ').toLowerCase();
  const topics = [
    { test: /ра|ры|ро|ру|р[еиёюя]|звук\s*р/iu, ru: 'звук Р', uk: 'звук Р' },
    { test: /ла|лы|ло|лу|л[еиёюя]|звук\s*л/iu, ru: 'звук Л', uk: 'звук Л' },
    { test: /ша|шо|шу|жи|жук|шип|звук\s*ш|звук\s*ж/iu, ru: 'шипящие звуки', uk: 'шиплячі звуки' },
    { test: /са|со|су|за|зо|зу|свист|звук\s*с|звук\s*з/iu, ru: 'свистящие звуки', uk: 'свистячі звуки' },
    { test: /вдох|выдох|д[ыи]х|дуй|дих|вдих|видих/iu, ru: 'дыхание', uk: 'дихання' },
    { test: /улыбк|трубочк|язык|губ|усміш|язик/iu, ru: 'артикуляционная разминка', uk: 'артикуляційна розминка' },
    { test: /кот|кошка|собак|заяц|лиса|медвед|тигр|лев|панда|кіт|заєць|лисиц|ведмед/iu, ru: 'животные', uk: 'тварини' },
    { test: /сказ|дракон|принцесс|рыцар|замок|фе|казк|принцес|лицар|чарів/iu, ru: 'сказочные герои', uk: 'казкові герої' },
  ];

  return topics
    .filter((topic) => topic.test.test(allText))
    .map((topic) => language === 'uk' ? topic.uk : topic.ru)
    .slice(0, 5);
};

const extractReportTasks = (modelTurns = []) => {
  const taskPattern = /(повтори|скажи|произнеси|покажи|сделай|давай|вдох|выдох|дуй|вимови|зроби|вдих|видих)/iu;

  return modelTurns
    .map((item) => trimReportText(item.text, 160))
    .filter((text) => taskPattern.test(text))
    .slice(0, 6);
};

const buildSessionReport = (payload) => {
  const child = payload.child || {};
  const language = payload.language === 'uk' ? 'uk' : 'ru';
  const isUk = language === 'uk';
  const transcript = Array.isArray(payload.transcript) ? payload.transcript : [];
  const transcriptText = formatTranscript(transcript, language);
  const { childTurns, modelTurns } = getReportTranscriptParts(transcript);
  const topics = detectReportTopics(transcript, language);
  const tasks = extractReportTasks(modelTurns);
  const childExamples = childTurns.map((item) => trimReportText(item.text, 100)).slice(-6);
  const durationMinutes = Math.max(1, Math.round((payload.durationSeconds || 0) / 60));
  const date = new Date(payload.finishedAt || Date.now()).toLocaleString(isUk ? 'uk-UA' : 'ru-RU');
  const emptyTranscriptText = isUk
    ? 'Транскрипт відсутній: заняття завершилося до появи розпізнаного мовлення.'
    : 'Транскрипт отсутствует: занятие завершилось до появления распознанной речи.';
  const medicalNotice = isUk
    ? 'Важливо: звіт не є медичним висновком і не замінює консультацію спеціаліста.'
    : 'Важно: отчет не является медицинским заключением и не заменяет консультацию специалиста.';

  const summary = isUk
    ? [
      `Дата заняття: ${date}`,
      `Дитина: ${child.name || 'не вказано'}`,
      `Вік: ${child.age || 'не вказано'}`,
      `Тривалість: близько ${durationMinutes} хв.`,
      'Мова заняття: українська',
    ].join('\n')
    : [
      `Дата занятия: ${date}`,
      `Ребенок: ${child.name || 'не указано'}`,
      `Возраст: ${child.age || 'не указан'}`,
      `Продолжительность: около ${durationMinutes} мин.`,
      'Язык занятия: русский',
    ].join('\n');

  const facts = isUk
    ? [
      `Реплік Dr. Logo: ${modelTurns.length}`,
      `Реплік дитини: ${childTurns.length}`,
      topics.length ? `Розпізнані теми: ${topics.join(', ')}` : 'Розпізнані теми: недостатньо даних у транскрипті',
      tasks.length ? `Завдання Dr. Logo: ${tasks.join(' / ')}` : 'Завдання Dr. Logo: окремі вправи не розпізнано',
      childExamples.length ? `Відповіді дитини: ${childExamples.map((text) => `“${text}”`).join('; ')}` : 'Відповіді дитини: у транскрипті не збережені',
    ].join('\n')
    : [
      `Реплик Dr. Logo: ${modelTurns.length}`,
      `Реплик ребенка: ${childTurns.length}`,
      topics.length ? `Распознанные темы: ${topics.join(', ')}` : 'Распознанные темы: недостаточно данных в транскрипте',
      tasks.length ? `Задания Dr. Logo: ${tasks.join(' / ')}` : 'Задания Dr. Logo: отдельные упражнения не распознаны',
      childExamples.length ? `Ответы ребенка: ${childExamples.map((text) => `“${text}”`).join('; ')}` : 'Ответы ребенка: в транскрипте не сохранены',
    ].join('\n');

  const nextSteps = isUk
    ? [
      childTurns.length === 0
        ? '1. У наступному занятті почати з дуже короткого завдання і дочекатися відповіді дитини.'
        : '1. У наступному занятті почати з короткого повторення останнього завдання.',
      topics.length
        ? `2. Повторити теми із заняття: ${topics.slice(0, 3).join(', ')}.`
        : '2. Повторити слова і склади, які реально прозвучали в діалозі.',
      tasks.length
        ? `3. Використати одне з уже даних завдань: ${tasks[0]}.`
        : '3. Якщо транскрипт знову буде неповним, перевірити мікрофон і гучність перед стартом.',
      '4. Не вважати цей звіт діагнозом: це конспект заняття за збереженим транскриптом.',
    ].join('\n')
    : [
      childTurns.length === 0
        ? '1. В следующем занятии начать с очень короткого задания и дождаться ответа ребенка.'
        : '1. В следующем занятии начать с короткого повторения последнего задания.',
      topics.length
        ? `2. Повторить темы из занятия: ${topics.slice(0, 3).join(', ')}.`
        : '2. Повторить слова и слоги, которые реально прозвучали в диалоге.',
      tasks.length
        ? `3. Использовать одно из уже данных заданий: ${tasks[0]}.`
        : '3. Если транскрипт снова будет неполным, проверить микрофон и громкость перед стартом.',
      '4. Не считать этот отчет диагнозом: это конспект занятия по сохраненному транскрипту.',
    ].join('\n');

  const text = [
    isUk ? 'Звіт Dr. Logo про голосове заняття' : 'Отчет Dr. Logo о голосовом занятии',
    '',
    summary,
    '',
    isUk ? 'Факти за транскриптом:' : 'Факты по транскрипту:',
    facts,
    '',
    isUk ? 'Повний транскрипт:' : 'Полный транскрипт:',
    transcriptText || emptyTranscriptText,
    '',
    isUk ? 'Що робити далі:' : 'Что делать дальше:',
    nextSteps,
    '',
    medicalNotice,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h1 style="color:#2563eb;">${isUk ? 'Звіт Dr. Logo' : 'Отчет Dr. Logo'}</h1>
      <h2>${isUk ? 'Стислий підсумок' : 'Сводка'}</h2>
      <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(summary)}</pre>
      <h2>${isUk ? 'Факти за транскриптом' : 'Факты по транскрипту'}</h2>
      <pre style="white-space:pre-wrap;font-family:inherit;background:#fff7ed;padding:16px;border-radius:12px;">${escapeHtml(facts)}</pre>
      <h2>${isUk ? 'Повний транскрипт' : 'Полный транскрипт'}</h2>
      <pre style="white-space:pre-wrap;font-family:inherit;background:#f8fafc;padding:16px;border-radius:12px;">${escapeHtml(transcriptText || emptyTranscriptText)}</pre>
      <h2>${isUk ? 'Що робити далі' : 'Что делать дальше'}</h2>
      <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(nextSteps)}</pre>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(medicalNotice)}</p>
    </div>
  `;

  const subject = isUk
    ? `Звіт Dr. Logo: заняття ${child.name || ''}`.trim()
    : `Отчет Dr. Logo: занятие ${child.name || ''}`.trim();

  return { subject, text, html };
};

const sendReportEmail = async ({ to, subject, text, html }) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL || 'Dr. Logo <onboarding@resend.dev>';

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY is not configured; session report email was skipped.');
    return { skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return { skipped: false };
};

const handleSessionReport = async (req, res) => {
  const user = requireSessionUser(req, res);

  if (!user) {
    return;
  }

  const payload = await readJson(req);
  const parentEmail = user.email;

  if (!parentEmail) {
    sendJson(res, 400, { error: 'parentEmail is required' });
    return;
  }

  const report = buildSessionReport(payload);
  const result = await sendReportEmail({ to: parentEmail, ...report });
  sendJson(res, 200, { ok: true, reportEmailSkipped: Boolean(result?.skipped) });
};

const sendStaticFile = async (req, res, pathname) => {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DIST_DIR, normalizedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath);

    res.writeHead(200, {
      'content-type': MIME_TYPES[extension] || 'application/octet-stream',
      'cache-control': requestedPath.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(file);
  } catch {
    const acceptsHtml = req.headers.accept?.includes('text/html');

    if (!acceptsHtml) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const indexFile = await fs.readFile(path.join(DIST_DIR, 'index.html'));
    res.writeHead(200, {
      'content-type': MIME_TYPES['.html'],
      'cache-control': 'no-cache',
    });
    res.end(indexFile);
  }
};

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', APP_ORIGIN);

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/login') {
      await handleAuthLogin(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/password-reset/request') {
      await handlePasswordResetRequest(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/password-reset/confirm') {
      await handlePasswordResetConfirm(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/auth/logout') {
      handleLogout(req, res);
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/profile') {
      handleGetProfile(req, res);
      return;
    }

    if (req.method === 'PUT' && requestUrl.pathname === '/api/profile') {
      await handleSaveProfile(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/openai/realtime/calls') {
      await handleOpenAiRealtimeCall(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/dashboard-greeting-audio') {
      await handleDashboardGreetingAudio(req, res);
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/session-report') {
      await handleSessionReport(req, res);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      await sendStaticFile(req, res, requestUrl.pathname);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Server ready on http://localhost:${PORT}`);
});
