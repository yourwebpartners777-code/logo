
import React, { useState } from 'react';
import { getUi } from '../i18n';
import { AppLanguage, UserData } from '../types';

type ChildGender = UserData['childGender'];

interface OnboardingFormProps {
  language: AppLanguage;
  email: string;
  onComplete: (data: UserData) => Promise<void>;
  onVoiceIntroConfirm: () => void;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ language, email, onComplete, onVoiceIntroConfirm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiceReady, setIsVoiceReady] = useState(false);
  const [formData, setFormData] = useState<Omit<UserData, 'email'>>({
    childName: '',
    childAge: '4',
    childGender: 'male'
  });
  const t = getUi(language).onboarding;
  const childGenderOptions: Array<{ value: ChildGender; label: string }> = [
    { value: 'male', label: t.male },
    { value: 'female', label: t.female },
  ];
  const headsetRecommendation = language === 'uk'
    ? 'Щоб досягти кращих результатів, рекомендуємо підключити гарнітуру'
    : 'Чтобы добиться лучших результатов рекомендуем подключить гарнитуру';
  const voiceCreatingText = language === 'uk' ? 'Створюємо голос Dr. Logo...' : 'Создаем голос Dr. Logo...';
  const voiceReadyText = language === 'uk'
    ? 'Голос готовий. Натисніть “Зрозумів”, щоб почути привітання.'
    : 'Голос готов. Нажмите “Понял”, чтобы услышать приветствие.';
  const understoodButton = language === 'uk' ? 'Зрозумів' : 'Понял';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onComplete({ ...formData, email });
      setIsVoiceReady(true);
    } finally {
      if (!isVoiceReady) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <>
      <div className="onboarding-screen flex flex-col items-center justify-center p-6 space-y-6 animate-fadeIn relative z-10">
        <form onSubmit={handleSubmit} className="onboarding-card w-full max-w-md">
          <div className="session-result-modal__badge">Dr. Logo</div>
          <div className="onboarding-card__header">
            <h2 className="onboarding-card__title">{t.title}</h2>
            <p className="onboarding-helper">{t.subtitle}</p>
          </div>
          <div className="onboarding-field-group">
            <label className="onboarding-label block font-bold mb-2">{t.childName}</label>
            <input 
              type="text"
              value={formData.childName}
              onChange={(e) => setFormData(prev => ({ ...prev, childName: e.target.value }))}
              className="onboarding-field w-full px-4 py-3 rounded-xl border-2 border-transparent focus:border-blue-300 outline-none"
              placeholder={t.childNamePlaceholder}
              required
            />
          </div>

          <div className="onboarding-grid">
            <div className="onboarding-field-group">
              <label className="onboarding-label block font-bold mb-2">{t.age}</label>
              <select 
                value={formData.childAge}
                onChange={(e) => setFormData(prev => ({ ...prev, childAge: e.target.value }))}
                className="onboarding-field w-full px-4 py-3 rounded-xl border-2 border-transparent focus:border-blue-300 outline-none"
              >
                {[3,4,5,6,7,8].map(age => <option key={age} value={age}>{t.ageOption(age)}</option>)}
              </select>
            </div>
            <div className="onboarding-field-group">
              <label className="onboarding-label block font-bold mb-2">{t.gender}</label>
              <select 
                value={formData.childGender}
                onChange={(e) => setFormData(prev => ({ ...prev, childGender: e.target.value as ChildGender }))}
                className="onboarding-field w-full px-4 py-3 rounded-xl border-2 border-transparent focus:border-blue-300 outline-none"
              >
                {childGenderOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="onboarding-submit"
          >
            {isSubmitting
              ? (language === 'uk' ? 'Створюємо голос...' : 'Создаем голос...')
              : t.submit}
          </button>
        </form>
      </div>
      {(isSubmitting || isVoiceReady) && (
        <div className="onboarding-headset-backdrop" role="status" aria-live="polite">
          <div className="onboarding-headset-modal">
            <div className="session-result-modal__badge">Dr. Logo</div>
            <div className="headset-illustration" aria-hidden="true">
              <span className="headset-illustration__band" />
              <span className="headset-illustration__ear headset-illustration__ear--left" />
              <span className="headset-illustration__ear headset-illustration__ear--right" />
              <span className="headset-illustration__mic-arm" />
              <span className="headset-illustration__mic" />
            </div>
            <p>{headsetRecommendation}</p>
            <div className="onboarding-headset-modal__status">
              {isVoiceReady ? voiceReadyText : voiceCreatingText}
            </div>
            {isVoiceReady ? (
              <button
                type="button"
                className="onboarding-headset-modal__confirm"
                onClick={onVoiceIntroConfirm}
              >
                {understoodButton}
              </button>
            ) : (
              <div className="onboarding-headset-modal__loader" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
