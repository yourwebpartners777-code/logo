
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, AppState, UserData } from './types';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingForm } from './components/OnboardingForm';
import { VoiceSession } from './components/VoiceSession';
import { PandaBalloons } from './components/PandaBalloons';
import { BambooForest } from './components/BambooForest';
import { AchievementsScreen } from './components/AchievementsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { CoursePlanModal } from './components/CoursePlanModal';
import { getUi } from './i18n';
import { LanguageModal } from './components/LanguageModal';
import { createDashboardGreetingClip, DashboardGreetingClip } from './services/voice-session';
import { loadAccount, loginAccount, logoutAccount, saveAccount } from './services/account-api';
import { CoursePlan, loadCoursePlan } from './services/subscription-gate';

const SETTINGS_STORAGE_KEY = 'dr_logo_settings';
const AUTH_TOKEN_STORAGE_KEY = 'dr_logo_auth_token';
const LANGUAGE_SELECTED_STORAGE_KEY = 'dr_logo_language_selected';
const DASHBOARD_VOICE_PROFILE_STORAGE_KEY = 'dr_logo_dashboard_voice_profile';
const DASHBOARD_VOICE_GREETING_LAST_PLAYED_STORAGE_KEY = 'dr_logo_dashboard_voice_greeting_last_played';
const COURSE_PLAN_DISMISSED_STORAGE_KEY = 'dr_logo_course_plan_dismissed';
const DASHBOARD_VOICE_PROFILE_VERSION = 3;
const DASHBOARD_VOICE_GREETING_COOLDOWN_MS = 5 * 60 * 1000;
const SESSION_START_ANIMATION_MS = 1650;

const defaultSettings: AppSettings = {
  language: 'ru',
  emailReportsEnabled: true,
};

const balloonLetterColors = ['#fb7185', '#38bdf8', '#facc15', '#22c55e', '#a78bfa', '#f97316', '#2dd4bf'];

const renderBalloonText = (text: string, className: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean);

  return (
    <span className={className} aria-label={text}>
      {words.map((word, wordIndex) => (
        <span key={`${word}-${wordIndex}`} className="balloon-text__word" aria-hidden="true">
          {Array.from(word).map((character, characterIndex) => {
            const colorIndex = character.charCodeAt(0) + wordIndex + characterIndex;
            return (
              <span
                key={`${character}-${characterIndex}`}
                className="balloon-text__letter balloon-text__letter--stringed"
                style={{ '--balloon-color': balloonLetterColors[colorIndex % balloonLetterColors.length] } as React.CSSProperties}
              >
                <span className="balloon-text__glyph">{character}</span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
};

interface DashboardVoiceProfile {
  version: number;
  key: string;
  text: string;
  dataUrl: string;
  mimeType: string;
  createdAt: string;
}

const getDashboardVoiceProfileKey = (userData: UserData, settings: AppSettings) => [
  userData.email,
  userData.childName.trim(),
  userData.childGender,
  settings.language,
].join('|');

const getDashboardGreetingCooldownKey = (userData: UserData, settings: AppSettings) => [
  DASHBOARD_VOICE_GREETING_LAST_PLAYED_STORAGE_KEY,
  getDashboardVoiceProfileKey(userData, settings),
].join(':');

const canPlayDashboardGreeting = (userData: UserData, settings: AppSettings) => {
  const lastPlayedAt = Number(localStorage.getItem(getDashboardGreetingCooldownKey(userData, settings)) || 0);
  return !lastPlayedAt || Date.now() - lastPlayedAt >= DASHBOARD_VOICE_GREETING_COOLDOWN_MS;
};

const markDashboardGreetingPlayed = (userData: UserData, settings: AppSettings) => {
  localStorage.setItem(getDashboardGreetingCooldownKey(userData, settings), String(Date.now()));
};

const getCoursePlanDismissedKey = (plan: CoursePlan) => [
  COURSE_PLAN_DISMISSED_STORAGE_KEY,
  plan.email.trim().toLowerCase(),
  plan.createdAt,
].join(':');

const hasCoursePlanBeenDismissed = (plan: CoursePlan | null) => (
  plan ? localStorage.getItem(getCoursePlanDismissedKey(plan)) === 'true' : false
);

const getDashboardGreetingText = (userData: UserData, settings: AppSettings) => {
  const readyWord = settings.language === 'uk'
    ? (userData.childGender === 'female' ? 'готова' : 'готовий')
    : (userData.childGender === 'female' ? 'готова' : 'готов');

  return settings.language === 'uk'
    ? `Привіт, ${userData.childName.trim()}, коли будеш ${readyWord}, просто натисни на м'яч.`
    : `Привет, ${userData.childName.trim()}, когда будешь ${readyWord}, просто нажми на мяч.`;
};

const saveDashboardVoiceProfile = async (userData: UserData, settings: AppSettings, authToken: string) => {
  const clip: DashboardGreetingClip = await createDashboardGreetingClip({ settings, userData, authToken });
  const profile: DashboardVoiceProfile = {
    version: DASHBOARD_VOICE_PROFILE_VERSION,
    key: getDashboardVoiceProfileKey(userData, settings),
    text: clip.text,
    dataUrl: clip.dataUrl,
    mimeType: clip.mimeType,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(DASHBOARD_VOICE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
};

const loadDashboardVoiceProfile = (userData: UserData, settings: AppSettings): DashboardVoiceProfile | null => {
  const expectedKey = getDashboardVoiceProfileKey(userData, settings);
  const savedProfile = localStorage.getItem(DASHBOARD_VOICE_PROFILE_STORAGE_KEY);

  if (!savedProfile) {
    return null;
  }

  try {
    const profile = JSON.parse(savedProfile) as DashboardVoiceProfile;
    return profile.version === DASHBOARD_VOICE_PROFILE_VERSION
      && profile.key === expectedKey
      && profile.text === getDashboardGreetingText(userData, settings)
      && Boolean(profile.dataUrl)
      ? profile
      : null;
  } catch {
    return null;
  }
};

const ensureDashboardVoiceProfile = async (userData: UserData, settings: AppSettings, authToken: string) => {
  return loadDashboardVoiceProfile(userData, settings) || saveDashboardVoiceProfile(userData, settings, authToken);
};

const playDashboardVoiceProfile = (profile: DashboardVoiceProfile) => {
  const audio = new Audio(profile.dataUrl);
  void audio.play().catch((error) => {
    console.error('Dashboard voice imprint playback failed:', error);
  });
  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [coursePlan, setCoursePlan] = useState<CoursePlan | null>(null);
  const [isCoursePlanDismissed, setIsCoursePlanDismissed] = useState(false);
  const [pendingOnboardingVoiceProfile, setPendingOnboardingVoiceProfile] = useState<DashboardVoiceProfile | null>(null);
  const dashboardGreetingCleanupRef = useRef<(() => void) | null>(null);
  const onboardingVoiceProfileRef = useRef<DashboardVoiceProfile | null>(null);

  useEffect(() => {
    const hasPasswordResetToken = new URLSearchParams(window.location.search).has('resetToken');
    const savedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const localSettings = savedSettings
      ? { ...defaultSettings, ...JSON.parse(savedSettings) }
      : defaultSettings;

    if (savedSettings) {
      setSettings(localSettings);
    }

    setShowLanguageModal(localStorage.getItem(LANGUAGE_SELECTED_STORAGE_KEY) !== 'true');

    if (hasPasswordResetToken) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthToken('');
      setAppState(AppState.AUTH);
      return;
    }

    if (!savedToken) {
      return;
    }

    setAuthToken(savedToken);
    void loadAccount(savedToken)
      .then((account) => {
        const effectiveSettings = account.hasProfile
          ? account.settings
          : { ...account.settings, language: localSettings.language };

        const savedCoursePlan = loadCoursePlan(account.user.email, account.user.childName);

        setUserData(account.user);
        setCoursePlan(savedCoursePlan);
        setIsCoursePlanDismissed(hasCoursePlanBeenDismissed(savedCoursePlan));
        setSettings(effectiveSettings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(effectiveSettings));
        setPendingEmail(account.user.email);

        if (!account.hasProfile && account.settings.language !== effectiveSettings.language) {
          void saveAccount(savedToken, account.user, effectiveSettings).catch((error) => {
            console.error('Failed to persist selected language:', error);
          });
        }

        setAppState(account.hasProfile ? AppState.DASHBOARD : AppState.ONBOARDING);
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        setAuthToken('');
        setAppState(AppState.AUTH);
      });
  }, []);

  const handleAuthSuccess = async (email: string, password: string) => {
    setAuthError('');
    setIsAuthSubmitting(true);

    try {
      const account = await loginAccount(email, password);
      const token = account.token || '';
      const effectiveSettings = account.hasProfile
        ? account.settings
        : { ...account.settings, language: settings.language };

      setAuthToken(token);
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      setPendingEmail(account.user.email);
      const savedCoursePlan = loadCoursePlan(account.user.email, account.user.childName);

      setUserData(account.user);
      setCoursePlan(savedCoursePlan);
      setIsCoursePlanDismissed(hasCoursePlanBeenDismissed(savedCoursePlan));
      setSettings(effectiveSettings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(effectiveSettings));

      if (!account.hasProfile && account.settings.language !== effectiveSettings.language) {
        void saveAccount(token, account.user, effectiveSettings).catch((error) => {
          console.error('Failed to persist selected language:', error);
        });
      }

      setAppState(account.hasProfile ? AppState.DASHBOARD : AppState.ONBOARDING);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Auth failed');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleOnboardingComplete = async (data: UserData) => {
    if (!authToken) {
      setAppState(AppState.AUTH);
      return;
    }

    const account = await saveAccount(authToken, data, settings);

    setUserData(account.user);
    const savedCoursePlan = loadCoursePlan(account.user.email, account.user.childName);
    setCoursePlan(savedCoursePlan);
    setIsCoursePlanDismissed(hasCoursePlanBeenDismissed(savedCoursePlan));
    setSettings(account.settings);
    const voiceProfile = await saveDashboardVoiceProfile(account.user, account.settings, authToken)
      .catch((error) => {
        console.error('Failed to create dashboard voice imprint:', error);
        return null;
      });

    onboardingVoiceProfileRef.current = voiceProfile;
    setPendingOnboardingVoiceProfile(voiceProfile);
  };

  const handleOnboardingVoiceIntroConfirm = () => {
    if (!userData) {
      setAppState(AppState.DASHBOARD);
      return;
    }

    const voiceProfile = onboardingVoiceProfileRef.current
      || pendingOnboardingVoiceProfile
      || loadDashboardVoiceProfile(userData, settings);

    if (voiceProfile) {
      dashboardGreetingCleanupRef.current?.();
      dashboardGreetingCleanupRef.current = playDashboardVoiceProfile(voiceProfile);
      markDashboardGreetingPlayed(userData, settings);
    } else {
      console.error('Dashboard voice imprint is not available after onboarding.');
    }

    onboardingVoiceProfileRef.current = null;
    setPendingOnboardingVoiceProfile(null);
    setAppState(AppState.DASHBOARD);
  };

  const handleSettingsSave = async (nextSettings: AppSettings, nextUserData?: UserData) => {
    if (!authToken || !nextUserData) {
      setSettings(nextSettings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      return;
    }

    const account = await saveAccount(authToken, nextUserData, nextSettings);
    const savedCoursePlan = loadCoursePlan(account.user.email, account.user.childName);

    setSettings(account.settings);
    setUserData(account.user);
    setCoursePlan(savedCoursePlan);
    setIsCoursePlanDismissed(hasCoursePlanBeenDismissed(savedCoursePlan));
    setAppState(AppState.DASHBOARD);
  };

  const handleLanguageChange = (language: AppSettings['language']) => {
    setSettings((prev) => {
      const nextSettings = { ...prev, language };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      return nextSettings;
    });
  };

  const handleInitialLanguageSelect = (language: AppSettings['language']) => {
    handleLanguageChange(language);
    localStorage.setItem(LANGUAGE_SELECTED_STORAGE_KEY, 'true');
    window.setTimeout(() => setShowLanguageModal(false), 520);
  };

  const startSession = () => {
    if (isStartingSession) {
      return;
    }

    dashboardGreetingCleanupRef.current?.();
    dashboardGreetingCleanupRef.current = null;
    setIsStartingSession(true);
    window.setTimeout(() => {
      setAppState(AppState.GAME_SESSION);
      setIsStartingSession(false);
    }, SESSION_START_ANIMATION_MS);
  };
  const endSession = () => {
    setIsStartingSession(false);
    setAppState(AppState.DASHBOARD);
  };
  const handleCoursePlanReady = (plan: CoursePlan) => {
    setCoursePlan(plan);
    setIsCoursePlanDismissed(false);
  };
  const handleCoursePlanContinue = () => {
    if (!coursePlan) {
      return;
    }

    localStorage.setItem(getCoursePlanDismissedKey(coursePlan), 'true');
    setIsCoursePlanDismissed(true);
  };
  const openAchievements = () => setAppState(AppState.ACHIEVEMENTS);
  const openSettings = () => setAppState(AppState.SETTINGS);
  const logout = () => {
    if (confirm(getUi(settings.language).dashboard.logoutConfirm)) {
      if (authToken) {
        void logoutAccount(authToken);
      }

      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setUserData(null);
      setCoursePlan(null);
      setIsCoursePlanDismissed(false);
      setPendingEmail('');
      setAuthToken('');
      setAppState(AppState.AUTH);
    }
  }

  const getThemeClass = () => {
    if (!userData) return 'theme-default';
    return userData.childGender === 'female' ? 'theme-female' : 'theme-male';
  };

  const renderContent = () => {
    const isPink = userData?.childGender === 'female';
    const t = getUi(settings.language);
    
    switch (appState) {
      case AppState.AUTH:
        return (
          <AuthScreen
            language={settings.language}
            onSuccess={handleAuthSuccess}
            errorMessage={authError}
            isSubmitting={isAuthSubmitting}
          />
        );
      
      case AppState.ONBOARDING:
        return (
          <OnboardingForm
            language={settings.language}
            email={pendingEmail}
            onComplete={handleOnboardingComplete}
            onVoiceIntroConfirm={handleOnboardingVoiceIntroConfirm}
          />
        );
      
      case AppState.ACHIEVEMENTS:
        return <AchievementsScreen language={settings.language} userData={userData} onBack={() => setAppState(AppState.DASHBOARD)} isPink={isPink} />;

      case AppState.SETTINGS:
        return (
          <SettingsScreen
            settings={settings}
            userData={userData}
            language={settings.language}
            onBack={() => setAppState(AppState.DASHBOARD)}
            onSave={handleSettingsSave}
            onLogout={logout}
          />
        );

      case AppState.DASHBOARD:
        return (
          <div className={`dashboard-screen flex flex-col items-center min-h-[80vh] p-6 animate-fadeIn relative z-10 w-full ${isStartingSession ? 'dashboard--starting-session' : ''}`}>
            <div className="text-center dashboard-greeting">
              <h2 className="dashboard-greeting__title">
                {renderBalloonText(t.dashboard.greeting(userData?.childName), 'balloon-text balloon-text--title')}
              </h2>
              <p className={`dashboard-greeting__subtitle ${isPink ? 'dashboard-greeting__subtitle--pink' : 'dashboard-greeting__subtitle--blue'}`}>
                {t.dashboard.ready(userData?.childGender)}
              </p>
            </div>
            <div className="dashboard-ball-wrap relative group">
              <div className={`play-ball-glow absolute bg-gradient-to-r ${isPink ? 'from-pink-300 via-rose-300 to-yellow-200' : 'from-sky-300 via-cyan-200 to-yellow-200'} rounded-full transition duration-500`}></div>
              <button
                onClick={startSession}
                disabled={isStartingSession}
                className={`play-ball relative ${isPink ? 'play-ball--pink' : 'play-ball--blue'}`}
              >
                <span className="play-ball__shine" />
                <span className="play-ball__label" aria-label={t.dashboard.play}>
                  {t.dashboard.play.split('').map((letter, index) => (
                    <span key={`${letter}-${index}`} className="play-ball__letter" aria-hidden="true">
                      {letter}
                    </span>
                  ))}
                </span>
              </button>
            </div>

            <div className="dashboard-bottom">
              <button 
                onClick={openAchievements}
                className={`dashboard-action-button ${isPink ? 'dashboard-action-button--pink' : 'dashboard-action-button--blue'}`}
                title={t.dashboard.achievementsTitle}
              >
                <span className="dashboard-action-button__icon">🏆</span>
              </button>
              <p className="parent-notice">{t.dashboard.parentNotice}</p>
              <button 
                onClick={openSettings}
                className={`dashboard-action-button ${isPink ? 'dashboard-action-button--pink' : 'dashboard-action-button--blue'}`}
                title={t.dashboard.settingsTitle}
              >
                <span className="dashboard-action-button__icon">⚙️</span>
              </button>
            </div>
          </div>
        );

      case AppState.GAME_SESSION:
        if (!userData) return null;
        return <VoiceSession settings={settings} userData={userData} authToken={authToken} onEnd={endSession} onCoursePlanReady={handleCoursePlanReady} entrance="from-right" />;

      default:
        return null;
    }
  };

  useEffect(() => {
    document.body.className = getThemeClass();
    document.documentElement.lang = settings.language;
  }, [userData, settings.language]);

  useEffect(() => {
    if (appState !== AppState.DASHBOARD || !userData || !authToken || showLanguageModal) {
      return;
    }

    let disposed = false;
    const timeoutId = window.setTimeout(() => {
      if (!canPlayDashboardGreeting(userData, settings)) {
        return;
      }

      void ensureDashboardVoiceProfile(userData, settings, authToken)
        .then((profile) => {
          if (disposed || !canPlayDashboardGreeting(userData, settings)) {
            return;
          }

          markDashboardGreetingPlayed(userData, settings);
          dashboardGreetingCleanupRef.current?.();
          dashboardGreetingCleanupRef.current = playDashboardVoiceProfile(profile);
        })
        .catch((error) => {
          console.error('Dashboard voice imprint failed:', error);
        });
    }, 700);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      dashboardGreetingCleanupRef.current?.();
      dashboardGreetingCleanupRef.current = null;
    };
  }, [appState, authToken, settings.language, showLanguageModal, userData]);

  return (
    <>
      <BambooForest />
      <div className={`app-shell max-w-md mx-auto min-h-screen relative flex flex-col pt-4 overflow-hidden ${appState === AppState.AUTH ? 'app-shell--auth' : ''} ${showLanguageModal ? 'app-shell--blurred' : ''}`}>
        <PandaBalloons language={settings.language} />
        {renderContent()}
      </div>
      {showLanguageModal && <LanguageModal onSelect={handleInitialLanguageSelect} />}
      {appState === AppState.DASHBOARD && coursePlan && !isCoursePlanDismissed && (
        <CoursePlanModal plan={coursePlan} onContinue={handleCoursePlanContinue} />
      )}
    </>
  );
};

export default App;
