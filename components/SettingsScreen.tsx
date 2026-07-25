import React, { useEffect, useMemo, useState } from 'react';
import { getUi, languageLabels } from '../i18n';
import { AppLanguage, AppSettings, UserData } from '../types';

type ChildProfile = Pick<UserData, 'childName' | 'childAge' | 'childGender'>;

const CHILD_PROFILES_STORAGE_KEY = 'dr_logo_child_profiles';

const getProfilesKey = (email: string) => `${CHILD_PROFILES_STORAGE_KEY}:${email.trim().toLowerCase()}`;
const getProfileId = (profile: ChildProfile) => [
  profile.childName.trim().toLowerCase(),
  profile.childAge,
  profile.childGender,
].join('|');

const normalizeProfile = (profile: ChildProfile): ChildProfile => ({
  childName: profile.childName.trim(),
  childAge: profile.childAge || '4',
  childGender: profile.childGender || 'male',
});

const mergeProfiles = (profiles: ChildProfile[], nextProfile: ChildProfile) => {
  const normalizedProfile = normalizeProfile(nextProfile);
  const profileMap = new Map<string, ChildProfile>();

  profiles
    .map(normalizeProfile)
    .filter((profile) => profile.childName)
    .forEach((profile) => profileMap.set(getProfileId(profile), profile));

  if (normalizedProfile.childName) {
    profileMap.set(getProfileId(normalizedProfile), normalizedProfile);
  }

  return Array.from(profileMap.values());
};

const loadChildProfiles = (email: string, currentProfile?: ChildProfile) => {
  if (!email.trim()) {
    return currentProfile?.childName ? [normalizeProfile(currentProfile)] : [];
  }

  try {
    const savedProfiles = JSON.parse(localStorage.getItem(getProfilesKey(email)) || '[]') as ChildProfile[];
    return currentProfile ? mergeProfiles(savedProfiles, currentProfile) : savedProfiles.map(normalizeProfile);
  } catch {
    return currentProfile?.childName ? [normalizeProfile(currentProfile)] : [];
  }
};

const saveChildProfiles = (email: string, profiles: ChildProfile[]) => {
  if (!email.trim()) {
    return;
  }

  localStorage.setItem(getProfilesKey(email), JSON.stringify(profiles.map(normalizeProfile)));
};

interface SettingsScreenProps {
  settings: AppSettings;
  userData: UserData | null;
  language: AppLanguage;
  onBack: () => void;
  onSave: (settings: AppSettings, userData?: UserData) => Promise<void>;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  userData,
  language,
  onBack,
  onSave,
  onLogout,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const currentProfile = useMemo<ChildProfile | undefined>(() => (
    userData
      ? {
          childName: userData.childName,
          childAge: userData.childAge,
          childGender: userData.childGender,
        }
      : undefined
  ), [userData]);
  const [profileData, setProfileData] = useState({
    email: userData?.email || '',
    password: '',
  });
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<ChildProfile[]>(() => loadChildProfiles(userData?.email || '', currentProfile));
  const [newProfile, setNewProfile] = useState<ChildProfile>({
    childName: '',
    childAge: '4',
    childGender: 'male',
  });
  const ui = getUi(formData.language || language);
  const t = ui.settings;
  const onboardingT = ui.onboarding;
  const profileCopy = formData.language === 'uk'
    ? {
        switchTitle: 'Зміна профілю',
        switchButton: 'Зміна профілю',
        active: 'Активний профіль',
        choose: 'Обрати',
        addTitle: 'Додати профіль',
        addButton: 'Додати профіль',
        deleteButton: 'Видалити',
        deleteConfirm: (name: string) => `Видалити профіль "${name}"?`,
        cannotDeleteLast: 'Не можна видалити останній активний профіль.',
        empty: 'Додайте профіль дитини, щоб швидко перемикатися між заняттями.',
      }
    : {
        switchTitle: 'Смена профиля',
        switchButton: 'Смена профиля',
        active: 'Активный профиль',
        choose: 'Выбрать',
        addTitle: 'Добавить профиль',
        addButton: 'Добавить профиль',
        deleteButton: 'Удалить',
        deleteConfirm: (name: string) => `Удалить профиль "${name}"?`,
        cannotDeleteLast: 'Нельзя удалить последний активный профиль.',
        empty: 'Добавьте профиль ребенка, чтобы быстро переключаться между занятиями.',
      };

  useEffect(() => {
    const nextProfiles = loadChildProfiles(userData?.email || '', currentProfile);
    setSavedProfiles(nextProfiles);

    if (userData?.email) {
      saveChildProfiles(userData.email, nextProfiles);
    }
  }, [currentProfile, userData?.email]);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveActiveProfile = async (profile: ChildProfile, password = profileData.password) => {
    if (!userData) {
      return;
    }

    const profiles = mergeProfiles(savedProfiles, profile);
    saveChildProfiles(profileData.email, profiles);
    setSavedProfiles(profiles);

    await onSave(formData, {
      ...userData,
      ...normalizeProfile(profile),
      email: profileData.email,
      password,
    });
  };

  const handleProfileSelect = async (profile: ChildProfile) => {
    await saveActiveProfile(profile, '');
  };

  const handleAddProfile = async () => {
    if (!newProfile.childName.trim()) {
      return;
    }

    await saveActiveProfile(newProfile, '');
    setNewProfile({ childName: '', childAge: '4', childGender: 'male' });
  };

  const handleDeleteProfile = async (profile: ChildProfile) => {
    if (!userData || !confirm(profileCopy.deleteConfirm(profile.childName))) {
      return;
    }

    const deletedProfileId = getProfileId(normalizeProfile(profile));
    const nextProfiles = savedProfiles.filter((item) => getProfileId(normalizeProfile(item)) !== deletedProfileId);
    const activeProfileId = currentProfile ? getProfileId(normalizeProfile(currentProfile)) : '';
    const isDeletingActiveProfile = deletedProfileId === activeProfileId;

    if (isDeletingActiveProfile && nextProfiles.length === 0) {
      alert(profileCopy.cannotDeleteLast);
      return;
    }

    saveChildProfiles(profileData.email, nextProfiles);
    setSavedProfiles(nextProfiles);

    if (isDeletingActiveProfile) {
      const nextActiveProfile = nextProfiles[0];
      await onSave(formData, {
        ...userData,
        ...normalizeProfile(nextActiveProfile),
        email: profileData.email,
        password: '',
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSave(
      formData,
      userData
        ? {
            ...userData,
            email: profileData.email,
            password: profileData.password,
          }
        : undefined,
    );
  };

  return (
    <div className="flex flex-col p-6 animate-fadeIn relative z-10 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center min-w-0">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-md mr-4">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-3xl font-black text-slate-700 truncate">{t.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsProfileSwitcherOpen((value) => !value)}
          className="relative w-14 h-14 shrink-0 rounded-full border-4 border-white bg-gradient-to-br from-sky-300 via-blue-500 to-emerald-400 text-white shadow-xl grid place-items-center transition-transform active:scale-95"
          aria-label={profileCopy.switchButton}
          title={profileCopy.switchButton}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 19.5c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
          </svg>
          <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-red-500 border-2 border-white text-white text-lg leading-none font-black grid place-items-center">
            +
          </span>
        </button>
      </div>

      {isProfileSwitcherOpen && (
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[2rem] shadow-xl border-4 border-white space-y-4 mb-6">
          <h3 className="font-black text-slate-700 text-xl">{profileCopy.switchTitle}</h3>

          {savedProfiles.length ? (
            <div className="space-y-3">
              {savedProfiles.map((profile) => {
                const isActive = currentProfile ? getProfileId(normalizeProfile(currentProfile)) === getProfileId(normalizeProfile(profile)) : false;

                return (
                  <div key={getProfileId(profile)} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 border-2 border-slate-100">
                    <div className="min-w-0">
                      <div className="font-black text-slate-700">{profile.childName}</div>
                      <div className="text-sm font-bold text-slate-400">
                        {onboardingT.ageOption(Number(profile.childAge))} · {profile.childGender === 'female' ? onboardingT.female : onboardingT.male}
                      </div>
                      {isActive && <div className="text-xs font-black text-green-600 mt-1">{profileCopy.active}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => void handleProfileSelect(profile)}
                          className="px-4 py-2 rounded-xl bg-blue-500 text-white font-black"
                        >
                          {profileCopy.choose}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteProfile(profile)}
                        className="w-10 h-10 rounded-full bg-white text-red-500 border-2 border-red-100 font-black grid place-items-center shadow-sm"
                        aria-label={profileCopy.deleteButton}
                        title={profileCopy.deleteButton}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7l.7-2h4.6L15 7" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l.7 13h6.6L16 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-400">{profileCopy.empty}</p>
          )}

          <div className="space-y-3 rounded-2xl bg-blue-50/70 p-4 border-2 border-blue-100">
            <h4 className="font-black text-blue-700">{profileCopy.addTitle}</h4>
            <input
              type="text"
              value={newProfile.childName}
              onChange={(event) => setNewProfile((prev) => ({ ...prev, childName: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-white border-2 border-transparent focus:border-blue-300 outline-none"
              placeholder={onboardingT.childNamePlaceholder}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newProfile.childAge}
                onChange={(event) => setNewProfile((prev) => ({ ...prev, childAge: event.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-transparent focus:border-blue-300 outline-none"
              >
                {[3, 4, 5, 6, 7, 8].map((age) => <option key={age} value={age}>{onboardingT.ageOption(age)}</option>)}
              </select>
              <select
                value={newProfile.childGender}
                onChange={(event) => setNewProfile((prev) => ({ ...prev, childGender: event.target.value as UserData['childGender'] }))}
                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-transparent focus:border-blue-300 outline-none"
              >
                <option value="male">{onboardingT.male}</option>
                <option value="female">{onboardingT.female}</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleAddProfile()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg py-3 rounded-2xl shadow-lg transition-all"
            >
              {profileCopy.addButton}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[2rem] shadow-xl border-4 border-white space-y-4">
          <div>
            <label className="block font-bold text-gray-700 mb-2">{t.email}</label>
            <input
              type="email"
              value={profileData.email}
              onChange={(event) => setProfileData((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none"
              placeholder="example@mail.com"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-2">{t.password}</label>
            <input
              type="password"
              value={profileData.password}
              onChange={(event) => setProfileData((prev) => ({ ...prev, password: event.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:border-blue-300 outline-none"
              placeholder={t.passwordPlaceholder}
              minLength={6}
            />
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[2rem] shadow-xl border-4 border-white">
          <label className="block font-bold text-gray-700 mb-3">{t.language}</label>
          <div className="grid grid-cols-2 gap-3">
            {(['ru', 'uk'] as AppLanguage[]).map((nextLanguage) => {
              const isActive = formData.language === nextLanguage;
              return (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => updateField('language', nextLanguage)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition-all border-2 ${
                    isActive
                      ? 'bg-red-500 text-white border-red-500 shadow-lg'
                      : 'bg-slate-50 text-slate-600 border-slate-100'
                  }`}
                >
                  {languageLabels[nextLanguage]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[2rem] shadow-xl border-4 border-white">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block font-bold text-gray-700">{t.emailReports}</span>
              <span className="block text-sm font-bold text-slate-400 mt-1">{t.emailReportsHint}</span>
            </span>
            <span className={`settings-toggle ${formData.emailReportsEnabled ? 'settings-toggle--active' : ''}`}>
              <input
                type="checkbox"
                checked={formData.emailReportsEnabled}
                onChange={(event) => updateField('emailReportsEnabled', event.target.checked)}
                className="sr-only"
              />
              <span className="settings-toggle__knob" />
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg py-4 rounded-2xl shadow-xl transition-all"
        >
          {t.save}
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-white text-red-500 font-black text-lg py-4 rounded-2xl shadow-md transition-all border-2 border-red-100"
        >
          {t.logout}
        </button>
      </form>
    </div>
  );
};
