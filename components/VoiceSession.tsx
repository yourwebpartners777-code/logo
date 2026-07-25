import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, SessionRecord, TranscriptionItem, UserData, VoiceSessionStatus } from '../types';
import { startVoiceSession } from '../services/voice-session';
import { PandaBalloons } from './PandaBalloons';
import { getUi } from '../i18n';
import { loadSessionProgressForUser, saveSessionRecord } from '../services/session-history';
import { buildCoursePlan, CoursePlan, isDiagnosticAnalysisComplete, saveCoursePlan } from '../services/subscription-gate';

type VoiceTurnMode = 'listen' | 'speak';

interface VoiceSessionProps {
  settings: AppSettings;
  userData: UserData;
  authToken: string;
  onEnd: () => void;
  onCoursePlanReady?: (plan: CoursePlan) => void;
  entrance?: 'from-right';
}

const sketchThemes = [
  {
    id: 'animals',
    ruTitle: 'Быстрый набросок: зверята',
    ukTitle: 'Швидкий начерк: звірята',
    words: ['живот', 'звер', 'кот', 'котик', 'кошка', 'собак', 'щен', 'заяц', 'зай', 'лиса', 'медвед', 'тигр', 'лев', 'панда', 'динозавр', 'тварин', 'кіт', 'котик', 'собак', 'заєць', 'зай', 'лисиц', 'ведмед', 'динозавр'],
    emoji: ['🐱', '🐶', '🐰'],
  },
  {
    id: 'fairy',
    ruTitle: 'Быстрый набросок: сказка',
    ukTitle: 'Швидкий начерк: казка',
    words: ['сказ', 'дракон', 'принцесс', 'рыцар', 'замок', 'фея', 'волшеб', 'единорог', 'эльф', 'герой', 'казк', 'принцес', 'лицар', 'замок', 'фея', 'єдиноріг', 'чарів', 'герой'],
    emoji: ['🏰', '🐉', '✨'],
  },
  {
    id: 'wish',
    ruTitle: 'Быстрый набросок: мечта',
    ukTitle: 'Швидкий начерк: мрія',
    words: ['хочу', 'мечт', 'люблю', 'подар', 'игруш', 'мяч', 'кукла', 'конфет', 'морожен', 'сюрприз', 'мрі', 'люблю', 'подар', 'іграш', 'ляльк', 'цукер', 'морозив'],
    emoji: ['🎁', '⭐', '🎈'],
  },
  {
    id: 'adventure',
    ruTitle: 'Быстрый набросок: приключение',
    ukTitle: 'Швидкий начерк: пригода',
    words: ['машин', 'ракета', 'самолет', 'самолёт', 'поезд', 'робот', 'космос', 'кораб', 'пират', 'путеше', 'літак', 'поїзд', 'робот', 'космос', 'кораб', 'пірат', 'подорож'],
    emoji: ['🚀', '🤖', '🌟'],
  },
  {
    id: 'speech',
    ruTitle: 'Быстрый набросок: звуки',
    ukTitle: 'Швидкий начерк: звуки',
    words: [],
    emoji: ['🗣️', '🌬️', '🎵'],
  },
] as const;

type SketchTheme = typeof sketchThemes[number];
type SketchThemeId = SketchTheme['id'];

const defaultSketchTheme = sketchThemes.at(-1)!;

const getSketchThemeById = (id: SketchThemeId) => sketchThemes.find((theme) => theme.id === id) || defaultSketchTheme;

const detectSketchTheme = (text: string): SketchTheme | null => {
  const normalizedText = text.toLowerCase();
  return sketchThemes.find((theme) => theme.words.some((word) => normalizedText.includes(word))) || null;
};

const getSketchTheme = (items: TranscriptionItem[]) => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const theme = detectSketchTheme(items[index].text);

    if (theme) {
      return theme;
    }
  }

  return defaultSketchTheme;
};

export const VoiceSession: React.FC<VoiceSessionProps> = ({ settings, userData, authToken, onEnd, onCoursePlanReady, entrance }) => {
  const [status, setStatus] = useState<VoiceSessionStatus>('connecting');
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([]);
  const [activeSketchThemeId, setActiveSketchThemeId] = useState<SketchThemeId>('speech');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [turnMode, setTurnMode] = useState<VoiceTurnMode>('listen');
  const [errorMessage, setErrorMessage] = useState('');
  const [endingRecord, setEndingRecord] = useState<SessionRecord | null>(null);
  const [showEarlyExitNotice, setShowEarlyExitNotice] = useState(false);
  const transcriptionsRef = useRef<TranscriptionItem[]>([]);
  const sessionCleanupRef = useRef<(() => Promise<void> | void) | null>(null);
  const savedSessionRecordRef = useRef<SessionRecord | null>(null);
  const reportSentRef = useRef(false);
  const sessionRecordSavedRef = useRef(false);
  const skipSessionSaveRef = useRef(false);
  const wasDiagnosticSessionRef = useRef(loadSessionProgressForUser(userData).stage === 'diagnostics');
  const sessionStartedAtRef = useRef(Date.now());
  const turnModeRef = useRef<VoiceTurnMode>('listen');

  const isPink = userData.childGender === 'female';
  const t = getUi(settings.language).voice;
  const sketchTheme = useMemo(() => getSketchThemeById(activeSketchThemeId) || getSketchTheme(transcriptions), [activeSketchThemeId, transcriptions]);

  const getDurationSeconds = () => Math.round((Date.now() - sessionStartedAtRef.current) / 1000);
  const isChildTurn = status === 'active' && turnMode === 'speak';
  const turnTitle = settings.language === 'uk'
    ? (isChildTurn ? 'Твоя черга говорити' : 'Слухай Dr. Logo')
    : (isChildTurn ? 'Твоя очередь говорить' : 'Слушай Dr. Logo');
  const turnHint = settings.language === 'uk'
    ? (isChildTurn ? 'Скажи відповідь у мікрофон' : 'Панда говорить, потім буде твоя черга')
    : (isChildTurn ? 'Скажи ответ в микрофон' : 'Панда говорит, потом будет твоя очередь');
  const resultTitle = settings.language === 'uk' ? 'Підсумок заняття' : 'Итог занятия';
  const resultButton = settings.language === 'uk' ? 'До м’яча' : 'К мячу';
  const resultEmpty = settings.language === 'uk'
    ? 'Конспект ще порожній: заняття завершилося дуже швидко.'
    : 'Конспект пока пустой: занятие завершилось очень быстро.';
  const earlyExitTitle = settings.language === 'uk'
    ? 'Dr. Logo дуже шкода, що ви йдете'
    : 'Dr. Logo очень жаль, что вы уходите';
  const earlyExitText = settings.language === 'uk'
    ? 'Аналіз мовлення ще не завершився, тому курс виправлення поки не складено. Можна повернутися пізніше і пройти первинний аналіз до кінця.'
    : 'Анализ речи еще не завершился, поэтому курс исправления пока не составлен. Можно вернуться позже и пройти первичный анализ до конца.';
  const earlyExitButton = settings.language === 'uk' ? 'Пока' : 'Пока';
  const updateSketchFromText = (text: string) => {
    const theme = detectSketchTheme(text);

    if (theme && theme.id !== 'speech') {
      setActiveSketchThemeId(theme.id);
    }
  };

  const saveSessionStats = () => {
    if (skipSessionSaveRef.current) {
      return null;
    }

    if (sessionRecordSavedRef.current) {
      return savedSessionRecordRef.current;
    }

    sessionRecordSavedRef.current = true;
    const record = saveSessionRecord({
      userData,
      language: settings.language,
      durationSeconds: getDurationSeconds(),
      transcript: transcriptionsRef.current,
      lastTurn: turnModeRef.current === 'speak' ? 'child' : 'doctor',
    });
    savedSessionRecordRef.current = record;

    if (wasDiagnosticSessionRef.current && isDiagnosticAnalysisComplete(transcriptionsRef.current)) {
      const plan = buildCoursePlan({
        userData,
        language: settings.language,
        transcript: transcriptionsRef.current,
      });
      saveCoursePlan(plan);
      onCoursePlanReady?.(plan);
    }

    return record;
  };

  const sendSessionReport = () => {
    if (reportSentRef.current) {
      return;
    }

    reportSentRef.current = true;

    if (!settings.emailReportsEnabled) {
      return;
    }

    const payload = {
      child: {
        name: userData.childName,
        age: userData.childAge,
        gender: userData.childGender,
      },
      language: settings.language,
      durationSeconds: getDurationSeconds(),
      finishedAt: new Date().toISOString(),
      transcript: transcriptionsRef.current,
    };

    const body = JSON.stringify(payload);

    void fetch('/api/session-report', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authToken}`,
        'content-type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch((error) => {
      console.error('Failed to send session report:', error);
    });
  };

  const handleEnd = () => {
    if (wasDiagnosticSessionRef.current && !isDiagnosticAnalysisComplete(transcriptionsRef.current)) {
      skipSessionSaveRef.current = true;
      void sessionCleanupRef.current?.();
      sessionCleanupRef.current = null;
      setShowEarlyExitNotice(true);
      return;
    }

    const record = saveSessionStats();
    sendSessionReport();
    void sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    setEndingRecord(record || null);
  };

  useEffect(() => {
    let disposed = false;
    sessionCleanupRef.current = null;

    const initialize = async () => {
      try {
        const session = await startVoiceSession({
          settings,
          userData,
          authToken,
          onStatusChange: (nextStatus) => {
            if (!disposed) {
              setStatus(nextStatus);
            }
          },
          onSpeakingChange: (nextSpeaking) => {
            if (!disposed) {
              setIsSpeaking(nextSpeaking);
            }
          },
          onTurnChange: (nextTurn) => {
            if (!disposed) {
              const nextTurnMode = nextTurn === 'user' ? 'speak' : 'listen';
              turnModeRef.current = nextTurnMode;
              setTurnMode(nextTurnMode);
            }
          },
          onSketchText: (text) => {
            if (!disposed) {
              updateSketchFromText(text);
            }
          },
          onTranscriptionTurn: (items) => {
            if (!disposed && items.length > 0) {
              const nextTheme = getSketchTheme(items);

              if (nextTheme.id !== 'speech') {
                setActiveSketchThemeId(nextTheme.id);
              }

              setTranscriptions((prev) => {
                const next = [...prev, ...items];
                transcriptionsRef.current = next;
                return next;
              });
            }
          },
          onError: (message, nextStatus = 'error') => {
            if (!disposed) {
              setErrorMessage(message);
              setStatus(nextStatus);
            }
          },
          onEnd: () => {
            if (!disposed) {
              if (!wasDiagnosticSessionRef.current || isDiagnosticAnalysisComplete(transcriptionsRef.current)) {
                saveSessionStats();
                sendSessionReport();
              }
              onEnd();
            }
          },
        });

        if (disposed) {
          await session.close();
          return;
        }

        sessionCleanupRef.current = session.close;
      } catch (error) {
        if (!disposed) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : t.failedStart);
        }
      }
    };

    initialize();

    return () => {
      disposed = true;
      const hasEnoughAnalysis = !wasDiagnosticSessionRef.current || isDiagnosticAnalysisComplete(transcriptionsRef.current);

      if (!skipSessionSaveRef.current && hasEnoughAnalysis) {
        saveSessionStats();
        sendSessionReport();
      }
      if (sessionCleanupRef.current) {
        void sessionCleanupRef.current();
        sessionCleanupRef.current = null;
      }
    };
  }, [settings, userData, authToken, onEnd, t.failedStart]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 overflow-hidden voice-session-screen ${entrance === 'from-right' ? 'voice-session-screen--from-right' : ''}`}>
      <PandaBalloons language={settings.language} />
      <div className="w-full flex items-center justify-center relative z-10 voice-session-header">
        <button
          onClick={handleEnd}
          className="voice-exit-door absolute left-0"
          aria-label={settings.language === 'uk' ? 'Вийти із заняття' : 'Выйти из занятия'}
        >
          <span className="voice-exit-door__cross" />
        </button>
        <div className={`bg-white px-6 py-2 rounded-2xl shadow-sm font-black ${isPink ? 'text-pink-600' : 'text-blue-600'} border-2 ${isPink ? 'border-pink-100' : 'border-blue-100'}`}>
          Dr. Logo
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center space-y-8 w-full max-w-lg voice-session-main">
        <div className={`relative w-52 h-52 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center justify-center overflow-hidden border-[6px] border-white voice-panda-frame ${isPink ? 'voice-panda-frame--pink' : 'voice-panda-frame--blue'}`}>
          <div className="doctor-panda-logo doctor-panda-logo--voice" aria-label={t.avatarAlt}>
            <span className="doctor-panda-logo__cap" />
            <span className="doctor-panda-logo__face" aria-hidden="true" />
            <span className="doctor-panda-logo__coat">
              <span className="doctor-panda-logo__cross">+</span>
            </span>
          </div>
        </div>

        <div className={`voice-turn-card ${isPink ? 'voice-turn-card--pink' : 'voice-turn-card--blue'} ${isChildTurn ? 'voice-turn-card--speak' : 'voice-turn-card--listen'}`}>
          {status === 'error' || status === 'unsupported' ? (
            <p className="voice-turn-card__error">{errorMessage || t.error}</p>
          ) : (
            <>
              <div className="voice-turn-card__stage">
                <span className="voice-turn-card__bulb-glow" />
                <span className="voice-turn-card__bulb" aria-hidden="true">
                  <span className="voice-turn-card__bulb-glass" />
                  <span className="voice-turn-card__bulb-shine" />
                  <span className="voice-turn-card__bulb-base" />
                </span>
              </div>
              <div className="voice-turn-card__title">{status === 'connecting' ? t.connecting : turnTitle}</div>
              <p className="voice-turn-card__hint">{status === 'connecting' ? t.hello : turnHint}</p>
            </>
          )}
        </div>
      </div>

      <div className="w-full relative z-10 pb-4 voice-session-footer" />
      {endingRecord && (
        <div className="session-result-backdrop">
          <div className="session-result-modal">
            <div className="session-result-modal__badge">Dr. Logo</div>
            <h2>{resultTitle}</h2>
            <p>{endingRecord.storySummary || resultEmpty}</p>
            <div className="session-result-modal__stats">
              <span>{endingRecord.duration}</span>
              <span>{endingRecord.turnsCount} {settings.language === 'uk' ? 'реплік' : 'реплик'}</span>
            </div>
            <div className="session-result-modal__achievements">
              {endingRecord.achievements.map((achievement) => (
                <span key={achievement}>⭐ {achievement}</span>
              ))}
            </div>
            <button type="button" onClick={onEnd}>{resultButton}</button>
          </div>
        </div>
      )}
      {showEarlyExitNotice && (
        <div className="session-result-backdrop">
          <div className="session-result-modal session-result-modal--early-exit">
            <div className="session-result-modal__badge">Dr. Logo</div>
            <h2>{earlyExitTitle}</h2>
            <p>{earlyExitText}</p>
            <button type="button" onClick={onEnd}>{earlyExitButton}</button>
          </div>
        </div>
      )}
    </div>
  );
};
