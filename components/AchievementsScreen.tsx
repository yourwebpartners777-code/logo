
import React, { useEffect, useMemo, useState } from 'react';
import { getUi } from '../i18n';
import { AppLanguage, SessionRecord, UserData } from '../types';
import { getSessionStats, loadSessionHistoryForUser } from '../services/session-history';

interface AchievementsScreenProps {
  language: AppLanguage;
  userData: UserData | null;
  onBack: () => void;
  isPink: boolean;
}

export const AchievementsScreen: React.FC<AchievementsScreenProps> = ({ language, userData, onBack, isPink }) => {
  const t = getUi(language).achievements;
  const [history, setHistory] = useState<SessionRecord[]>(() => userData ? loadSessionHistoryForUser(userData) : []);
  const [selectedReport, setSelectedReport] = useState<SessionRecord | null>(null);
  const stats = useMemo(() => getSessionStats(history), [history]);
  const level = stats.totalSessions >= 12
    ? (language === 'uk' ? 'Супергерой' : 'Супергерой')
    : stats.totalSessions >= 5
      ? (language === 'uk' ? 'Помічник' : 'Помощник')
      : t.beginner;
  const progressValue = `${stats.progressPercent}%`;
  const streakValue = language === 'uk' ? `${stats.activeDays} дн.` : `${stats.activeDays} дн.`;

  const colorClass = isPink ? 'text-pink-600' : 'text-blue-600';
  const accentBg = isPink ? 'bg-pink-500' : 'bg-blue-500';
  const softBg = isPink ? 'from-pink-100 via-white to-rose-100' : 'from-sky-100 via-white to-cyan-100';
  const chipClass = isPink ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-blue-100 text-blue-700 border-blue-200';
  const uniqueAchievements = Array.from(new Set(history.flatMap((record) => record.achievements))).slice(0, 8);

  useEffect(() => {
    if (!userData) {
      setHistory([]);
      return;
    }

    const loadHistory = () => setHistory(loadSessionHistoryForUser(userData));

    loadHistory();
    window.addEventListener('dr-logo-session-history-updated', loadHistory);
    return () => window.removeEventListener('dr-logo-session-history-updated', loadHistory);
  }, [userData]);

  return (
    <div className="flex flex-col p-5 animate-fadeIn relative z-10 w-full max-w-md mx-auto">
      <div className="flex items-center mb-5">
        <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-md mr-4 border-2 border-white active:scale-95 transition-transform">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className={`text-3xl font-black ${colorClass}`}>{t.title}</h2>
          <p className="text-sm font-bold text-slate-500">{t.lastSession}</p>
        </div>
      </div>

      <div className={`rounded-[2.4rem] p-5 shadow-2xl border-4 border-white bg-gradient-to-br ${softBg} overflow-hidden relative mb-5`}>
        <div className="absolute -right-6 -top-8 text-8xl opacity-20">🏆</div>
        <div className="relative">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/90 rounded-[1.4rem] p-3 text-center shadow-sm border-2 border-white">
              <div className="text-2xl">🏅</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.level}</div>
              <div className={`text-lg font-black ${colorClass}`}>{level}</div>
            </div>
            <div className="bg-white/90 rounded-[1.4rem] p-3 text-center shadow-sm border-2 border-white">
              <div className="text-2xl">🔥</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.streak}</div>
              <div className={`text-lg font-black ${colorClass}`}>{streakValue}</div>
            </div>
            <div className="bg-white/90 rounded-[1.4rem] p-3 text-center shadow-sm border-2 border-white">
              <div className="text-2xl">🎯</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.progress}</div>
              <div className={`text-lg font-black ${colorClass}`}>{progressValue}</div>
            </div>
          </div>

          <div className="bg-white/90 rounded-[1.6rem] p-4 shadow-sm border-2 border-white">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-black text-slate-700">{t.pronunciationWins}</h3>
              <span className={`text-sm font-black ${colorClass}`}>{progressValue}</span>
            </div>
            <div className="h-4 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div className={`h-full ${accentBg} rounded-full shadow-sm`} style={{ width: progressValue }} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(uniqueAchievements.length > 0 ? uniqueAchievements : t.tags.slice(0, 3)).map((tag, index) => (
                <span key={tag} className={`${chipClass} px-3 py-2 rounded-2xl text-xs font-black border-2 shadow-sm`}>
                  {index < 3 ? '⭐' : '✨'} {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/85 backdrop-blur rounded-[2rem] p-5 shadow-xl border-4 border-white">
        <h3 className="text-xl font-black mb-4 text-slate-700">{t.history}</h3>
        <div className="space-y-3">
          {history.length === 0 && (
            <div className="p-5 rounded-[1.5rem] bg-white border-2 border-slate-50 shadow-sm text-center">
              <div className="text-3xl mb-2">🎤</div>
              <div className={`font-black ${colorClass}`}>
                {language === 'uk' ? 'Занять ще немає' : 'Занятий пока нет'}
              </div>
              <p className="text-sm font-bold text-slate-400 mt-1">
                {language === 'uk' ? 'Натисніть на м’яч і завершіть перше заняття.' : 'Нажмите на мяч и завершите первое занятие.'}
              </p>
            </div>
          )}
          {history.map((record, recordIndex) => (
            <div key={record.id} className="p-4 rounded-[1.5rem] bg-white border-2 border-slate-50 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl ${accentBg} text-white flex items-center justify-center text-xl shadow-md`}>
                    {recordIndex === 0 ? '🎤' : '📚'}
                  </div>
                  <div>
                    <div className="font-black text-slate-700">{record.storyTitle || record.date}</div>
                    <div className="text-xs font-black text-slate-500">
                      {language === 'uk' ? 'Дата і час' : 'Дата и время'}: {record.date}
                    </div>
                    <div className="text-xs font-black text-slate-400 uppercase">
                      {record.duration} · {record.turnsCount} {language === 'uk' ? 'реплік' : 'реплик'}
                    </div>
                  </div>
                </div>
                <span className="text-lg">✅</span>
              </div>
              <p className="text-sm font-bold text-slate-500 leading-snug mb-3">
                {record.storySummary || (language === 'uk' ? 'Конспект старого заняття недоступний.' : 'Конспект старого занятия недоступен.')}
              </p>
              <div className="flex flex-wrap gap-2">
                {record.achievements.map((ach) => (
                  <span key={ach} className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-2xl">
                    {ach}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="session-report-button"
                onClick={() => setSelectedReport(record)}
              >
                {language === 'uk' ? 'Перегляд звіту' : 'Просмотр отчета'}
              </button>
              {record.transcript?.length > 0 && (
                <details className="session-story mt-3">
                  <summary>
                    {language === 'uk' ? 'Відкрити конспект' : 'Открыть конспект'}
                  </summary>
                  <div className="session-story__turns">
                    {record.transcript.map((item, index) => (
                      <div key={`${record.id}-${index}`} className={`session-story__turn session-story__turn--${item.speaker}`}>
                        <span>{item.speaker === 'user' ? (language === 'uk' ? 'Дитина' : 'Ребенок') : 'Dr. Logo'}</span>
                        <p>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
      {selectedReport && (
        <div className="session-result-backdrop">
          <div className="session-result-modal session-report-modal">
            <div className="session-result-modal__badge">Dr. Logo</div>
            <h2>{language === 'uk' ? 'Звіт за заняття' : 'Отчет за занятие'}</h2>
            <div className="session-result-modal__stats">
              <span>{selectedReport.date}</span>
              <span>{selectedReport.duration}</span>
              <span>{selectedReport.turnsCount} {language === 'uk' ? 'реплік' : 'реплик'}</span>
            </div>
            <p>{selectedReport.storySummary || (language === 'uk' ? 'Конспект старого заняття недоступний.' : 'Конспект старого занятия недоступен.')}</p>
            <div className="session-result-modal__achievements">
              {selectedReport.achievements.map((achievement) => (
                <span key={achievement}>⭐ {achievement}</span>
              ))}
            </div>
            {selectedReport.transcript?.length > 0 && (
              <div className="session-report-modal__transcript">
                {selectedReport.transcript.map((item, index) => (
                  <div key={`${selectedReport.id}-report-${index}`} className={`session-story__turn session-story__turn--${item.speaker}`}>
                    <span>{item.speaker === 'user' ? (language === 'uk' ? 'Дитина' : 'Ребенок') : 'Dr. Logo'}</span>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setSelectedReport(null)}>
              {language === 'uk' ? 'Закрити' : 'Закрыть'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
