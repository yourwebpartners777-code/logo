import { AppLanguage, SessionRecord, TranscriptionItem, UserData } from '../types';

const SESSION_HISTORY_STORAGE_KEY = 'dr_logo_session_history';
const SESSION_PROGRESS_STORAGE_KEY = 'dr_logo_session_progress';
const MAX_SESSION_RECORDS = 50;

const formatDuration = (durationSeconds: number, language: AppLanguage) => {
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return language === 'uk' ? `${minutes} хв` : `${minutes} мин`;
};

const formatDate = (date: Date, language: AppLanguage) => {
  return new Intl.DateTimeFormat(language === 'uk' ? 'uk-UA' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const normalizeKeyPart = (value: string) => value.trim().toLowerCase();
const getStorageKey = (email: string, childName = '') => `${SESSION_HISTORY_STORAGE_KEY}:${normalizeKeyPart(email)}${childName ? `:${normalizeKeyPart(childName)}` : ''}`;
const getProgressStorageKey = (email: string, childName = '') => `${SESSION_PROGRESS_STORAGE_KEY}:${normalizeKeyPart(email)}${childName ? `:${normalizeKeyPart(childName)}` : ''}`;
const getUserStorageKey = (userData: UserData) => getStorageKey(userData.email, userData.childName);
const getUserProgressStorageKey = (userData: UserData) => getProgressStorageKey(userData.email, userData.childName);

const trimText = (value: string, maxLength = 180) => {
  const normalized = value.replace(/\s+/g, ' ').trim();

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
};

const getTranscriptParts = (transcript: TranscriptionItem[]) => ({
  childTurns: transcript.filter((item) => item.speaker === 'user' && item.text.trim()),
  modelTurns: transcript.filter((item) => item.speaker === 'model' && item.text.trim()),
});

const detectSessionTopics = (transcript: TranscriptionItem[], language: AppLanguage) => {
  const allText = transcript.map((item) => item.text).join(' ').toLowerCase();
  const topics = [
    {
      test: /ра|ры|ро|ру|р[еиёюя]|звук\s*р|звук\s*р/iu,
      ru: 'звук Р',
      uk: 'звук Р',
    },
    {
      test: /ла|лы|ло|лу|л[еиёюя]|звук\s*л/iu,
      ru: 'звук Л',
      uk: 'звук Л',
    },
    {
      test: /ша|шо|шу|жи|жук|шип|звук\s*ш|звук\s*ж/iu,
      ru: 'шипящие звуки',
      uk: 'шиплячі звуки',
    },
    {
      test: /са|со|су|за|зо|зу|свист|звук\s*с|звук\s*з/iu,
      ru: 'свистящие звуки',
      uk: 'свистячі звуки',
    },
    {
      test: /вдох|выдох|д[ыи]х|дуй|дих|вдих|видих|дуй/iu,
      ru: 'дыхание',
      uk: 'дихання',
    },
    {
      test: /улыбк|трубочк|язык|губ|усміш|трубочк|язик|губ/iu,
      ru: 'артикуляционная разминка',
      uk: 'артикуляційна розминка',
    },
    {
      test: /кот|кошка|собак|заяц|лиса|медвед|тигр|лев|панда|тварин|кіт|собак|заєць|лисиц|ведмед/iu,
      ru: 'животные',
      uk: 'тварини',
    },
    {
      test: /сказ|дракон|принцесс|рыцар|замок|фе|казк|принцес|лицар|чарів/iu,
      ru: 'сказочные герои',
      uk: 'казкові герої',
    },
  ];

  return topics
    .filter((topic) => topic.test.test(allText))
    .map((topic) => language === 'uk' ? topic.uk : topic.ru)
    .slice(0, 4);
};

const extractModelTasks = (modelTurns: TranscriptionItem[]) => {
  const taskPattern = /(повтори|скажи|произнеси|покажи|сделай|давай|вдох|выдох|дуй|повтори|скажи|вимови|покажи|зроби|вдих|видих)/iu;

  return modelTurns
    .map((item) => trimText(item.text, 150))
    .filter((text) => taskPattern.test(text))
    .slice(0, 4);
};

const extractChildExamples = (childTurns: TranscriptionItem[]) => childTurns
  .map((item) => trimText(item.text, 90))
  .filter(Boolean)
  .slice(-4);

export interface SessionProgress {
  stage: 'diagnostics' | 'plan' | 'practice';
  completedSessions: number;
  lastFinishedAt: string;
  lastSummary: string;
  nextStep: string;
  exitPoint: string;
  lastTurn: 'doctor' | 'child' | 'unknown';
}

const buildAchievements = (
  transcript: TranscriptionItem[],
  durationSeconds: number,
  language: AppLanguage,
) => {
  const { childTurns, modelTurns } = getTranscriptParts(transcript);
  const topics = detectSessionTopics(transcript, language);
  const modelTasks = extractModelTasks(modelTurns);
  const achievements: string[] = [];

  if (language === 'uk') {
    achievements.push(`Реплік дитини: ${childTurns.length}`);
    if (durationSeconds >= 60) achievements.push('Хвилина практики');
    if (modelTasks.length > 0) achievements.push(`Завдань Dr. Logo: ${modelTasks.length}`);
    topics.slice(0, 2).forEach((topic) => achievements.push(`Тема: ${topic}`));
    if (childTurns.length >= 3) achievements.push('Активний діалог');
    return achievements.slice(0, 5);
  }

  achievements.push(`Реплик ребенка: ${childTurns.length}`);
  if (durationSeconds >= 60) achievements.push('Минута практики');
  if (modelTasks.length > 0) achievements.push(`Заданий Dr. Logo: ${modelTasks.length}`);
  topics.slice(0, 2).forEach((topic) => achievements.push(`Тема: ${topic}`));
  if (childTurns.length >= 3) achievements.push('Активный диалог');
  return achievements.slice(0, 5);
};

const buildProgressSummary = (transcript: TranscriptionItem[], language: AppLanguage) => {
  const { childTurns, modelTurns } = getTranscriptParts(transcript);
  const lastChildText = childTurns.at(-1)?.text?.trim() || '';
  const lastModelText = modelTurns.at(-1)?.text?.trim() || '';
  const topics = detectSessionTopics(transcript, language);
  const tasks = extractModelTasks(modelTurns);

  if (language === 'uk') {
    return {
      lastSummary: [
        `Було реплік дитини: ${childTurns.length}.`,
        topics.length ? `Теми заняття: ${topics.join(', ')}.` : '',
        tasks.length ? `Завдання Dr. Logo: ${tasks.join(' / ')}.` : '',
        lastChildText ? `Остання відповідь дитини: ${trimText(lastChildText, 160)}.` : 'Відповідей дитини ще не було.',
        lastModelText ? `Останній крок Dr. Logo: ${trimText(lastModelText, 160)}.` : '',
      ].filter(Boolean).join(' '),
      nextStep: childTurns.length === 0
        ? 'Наступного разу почати з дуже простого повторення складів і дочекатися відповіді.'
        : topics.length
          ? `Наступного разу коротко повторити: ${topics.slice(0, 2).join(', ')}.`
          : 'Наступного разу коротко повторити останнє завдання і перейти до наступної вправи плану.',
    };
  }

  return {
    lastSummary: [
      `Было реплик ребенка: ${childTurns.length}.`,
      topics.length ? `Темы занятия: ${topics.join(', ')}.` : '',
      tasks.length ? `Задания Dr. Logo: ${tasks.join(' / ')}.` : '',
      lastChildText ? `Последний ответ ребенка: ${trimText(lastChildText, 160)}.` : 'Ответов ребенка пока не было.',
      lastModelText ? `Последний шаг Dr. Logo: ${trimText(lastModelText, 160)}.` : '',
    ].filter(Boolean).join(' '),
    nextStep: childTurns.length === 0
      ? 'В следующий раз начать с очень простого повторения слогов и дождаться ответа.'
      : topics.length
        ? `В следующий раз коротко повторить: ${topics.slice(0, 2).join(', ')}.`
        : 'В следующий раз коротко повторить последнее задание и перейти к следующему упражнению плана.',
  };
};

const buildExitPoint = (
  transcript: TranscriptionItem[],
  language: AppLanguage,
  lastTurn: SessionProgress['lastTurn'],
) => {
  const lastItem = [...transcript].reverse().find((item) => item.text.trim());
  const lastText = lastItem ? trimText(lastItem.text, 150) : '';

  if (language === 'uk') {
    if (!lastItem) {
      return 'Заняття вийшло до появи транскрипту. Наступного разу почати з короткого привітання і першої простої проби.';
    }

    if (lastTurn === 'child') {
      return `Вихід був на черзі дитини. Перед продовженням коротко повторити останнє завдання Dr. Logo: ${lastText}.`;
    }

    if (lastItem.speaker === 'user') {
      return `Останньою була відповідь дитини: ${lastText}. Продовжити з короткої реакції на цю відповідь і наступної вправи.`;
    }

    return `Останній крок Dr. Logo: ${lastText}. Продовжити з цього завдання, не починати курс заново.`;
  }

  if (!lastItem) {
    return 'Занятие вышло до появления транскрипта. В следующий раз начать с короткого приветствия и первой простой пробы.';
  }

  if (lastTurn === 'child') {
    return `Выход был на очереди ребенка. Перед продолжением коротко повторить последнее задание Dr. Logo: ${lastText}.`;
  }

  if (lastItem.speaker === 'user') {
    return `Последним был ответ ребенка: ${lastText}. Продолжить с короткой реакции на этот ответ и следующего упражнения.`;
  }

  return `Последний шаг Dr. Logo: ${lastText}. Продолжить с этого задания, не начинать курс заново.`;
};

const buildSessionStory = (transcript: TranscriptionItem[], language: AppLanguage) => {
  const { childTurns, modelTurns } = getTranscriptParts(transcript);
  const topics = detectSessionTopics(transcript, language);
  const tasks = extractModelTasks(modelTurns);
  const childExamples = extractChildExamples(childTurns);
  const topic = topics.length
    ? topics.join(', ')
    : (language === 'uk' ? 'мовну практику' : 'речевую практику');

  if (language === 'uk') {
    return {
      storyTitle: `Реальний конспект: ${topic}`,
      storySummary: [
        `За транскриптом: реплік Dr. Logo - ${modelTurns.length}, реплік дитини - ${childTurns.length}.`,
        topics.length ? `Працювали з темами: ${topics.join(', ')}.` : '',
        tasks.length ? `Завдання, які прозвучали: ${tasks.join(' / ')}.` : 'Окремі вправи у транскрипті не розпізнані.',
        childExamples.length ? `Відповіді дитини: ${childExamples.map((text) => `“${text}”`).join('; ')}.` : 'Відповіді дитини у транскрипті не збережені.',
      ].filter(Boolean).join(' '),
    };
  }

  return {
    storyTitle: `Реальный конспект: ${topic}`,
    storySummary: [
      `По транскрипту: реплик Dr. Logo - ${modelTurns.length}, реплик ребенка - ${childTurns.length}.`,
      topics.length ? `Работали с темами: ${topics.join(', ')}.` : '',
      tasks.length ? `Задания, которые прозвучали: ${tasks.join(' / ')}.` : 'Отдельные упражнения в транскрипте не распознаны.',
      childExamples.length ? `Ответы ребенка: ${childExamples.map((text) => `“${text}”`).join('; ')}.` : 'Ответы ребенка в транскрипте не сохранены.',
    ].filter(Boolean).join(' '),
  };
};

export const loadSessionHistory = (email: string): SessionRecord[] => {
  const saved = localStorage.getItem(getStorageKey(email));

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as SessionRecord[];
  } catch {
    return [];
  }
};

export const loadSessionHistoryForUser = (userData: UserData): SessionRecord[] => {
  const saved = localStorage.getItem(getUserStorageKey(userData));

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as SessionRecord[];
  } catch {
    return [];
  }
};

export const saveSessionRecord = ({
  userData,
  language,
  durationSeconds,
  transcript,
  lastTurn = 'unknown',
}: {
  userData: UserData;
  language: AppLanguage;
  durationSeconds: number;
  transcript: TranscriptionItem[];
  lastTurn?: SessionProgress['lastTurn'];
}) => {
  const finishedAt = new Date();
  const childTurnsCount = transcript.filter((item) => item.speaker === 'user').length;
  const doctorTurnsCount = transcript.filter((item) => item.speaker === 'model').length;
  const record: SessionRecord = {
    id: `${finishedAt.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
    date: formatDate(finishedAt, language),
    finishedAt: finishedAt.toISOString(),
    duration: formatDuration(durationSeconds, language),
    durationSeconds,
    turnsCount: transcript.length,
    childTurnsCount,
    doctorTurnsCount,
    ...buildSessionStory(transcript, language),
    transcript,
    achievements: buildAchievements(transcript, durationSeconds, language),
  };
  const nextHistory = [record, ...loadSessionHistoryForUser(userData)].slice(0, MAX_SESSION_RECORDS);
  const progressSummary = buildProgressSummary(transcript, language);
  const exitPoint = buildExitPoint(transcript, language, lastTurn);

  localStorage.setItem(getUserStorageKey(userData), JSON.stringify(nextHistory));
  saveSessionProgressForUser(userData, {
    completedSessions: nextHistory.length,
    lastFinishedAt: record.finishedAt,
    lastSummary: progressSummary.lastSummary,
    nextStep: progressSummary.nextStep,
    exitPoint,
    lastTurn,
    stage: nextHistory.length <= 1 ? 'plan' : 'practice',
  });
  window.dispatchEvent(new CustomEvent('dr-logo-session-history-updated', { detail: { email: userData.email } }));

  return record;
};

export const loadSessionProgress = (email: string): SessionProgress => {
  const saved = localStorage.getItem(getProgressStorageKey(email));

  if (!saved) {
    return {
      stage: 'diagnostics',
      completedSessions: 0,
      lastFinishedAt: '',
      lastSummary: '',
      nextStep: '',
      exitPoint: '',
      lastTurn: 'unknown',
    };
  }

  try {
    const progress = JSON.parse(saved) as Partial<SessionProgress>;
    return {
      stage: progress.stage || 'diagnostics',
      completedSessions: progress.completedSessions || 0,
      lastFinishedAt: progress.lastFinishedAt || '',
      lastSummary: progress.lastSummary || '',
      nextStep: progress.nextStep || '',
      exitPoint: progress.exitPoint || '',
      lastTurn: progress.lastTurn || 'unknown',
    };
  } catch {
    return {
      stage: 'diagnostics',
      completedSessions: 0,
      lastFinishedAt: '',
      lastSummary: '',
      nextStep: '',
      exitPoint: '',
      lastTurn: 'unknown',
    };
  }
};

export const loadSessionProgressForUser = (userData: UserData): SessionProgress => {
  const saved = localStorage.getItem(getUserProgressStorageKey(userData));

  if (!saved) {
    return {
      stage: 'diagnostics',
      completedSessions: 0,
      lastFinishedAt: '',
      lastSummary: '',
      nextStep: '',
      exitPoint: '',
      lastTurn: 'unknown',
    };
  }

  try {
    const progress = JSON.parse(saved) as Partial<SessionProgress>;
    return {
      stage: progress.stage || 'diagnostics',
      completedSessions: progress.completedSessions || 0,
      lastFinishedAt: progress.lastFinishedAt || '',
      lastSummary: progress.lastSummary || '',
      nextStep: progress.nextStep || '',
      exitPoint: progress.exitPoint || '',
      lastTurn: progress.lastTurn || 'unknown',
    };
  } catch {
    return {
      stage: 'diagnostics',
      completedSessions: 0,
      lastFinishedAt: '',
      lastSummary: '',
      nextStep: '',
      exitPoint: '',
      lastTurn: 'unknown',
    };
  }
};

export const saveSessionProgress = (email: string, progress: SessionProgress) => {
  localStorage.setItem(getProgressStorageKey(email), JSON.stringify(progress));
};

export const saveSessionProgressForUser = (userData: UserData, progress: SessionProgress) => {
  localStorage.setItem(getUserProgressStorageKey(userData), JSON.stringify(progress));
};

export const getSessionStats = (history: SessionRecord[]) => {
  const totalDurationSeconds = history.reduce((sum, record) => sum + record.durationSeconds, 0);
  const totalChildTurns = history.reduce((sum, record) => sum + record.childTurnsCount, 0);
  const activeDays = new Set(history.map((record) => record.finishedAt.slice(0, 10))).size;

  return {
    totalSessions: history.length,
    totalDurationSeconds,
    totalChildTurns,
    activeDays,
    progressPercent: Math.min(100, Math.max(0, history.length * 8 + totalChildTurns * 3)),
  };
};
