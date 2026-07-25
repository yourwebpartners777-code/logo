import React, { useEffect, useState } from 'react';
import { languageLabels, languagePrompt } from '../i18n';
import { AppLanguage } from '../types';

interface LanguageModalProps {
  onSelect: (language: AppLanguage) => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ onSelect }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    document.body.classList.add('language-modal-open');

    return () => {
      document.body.classList.remove('language-modal-open');
    };
  }, []);

  const chooseLanguage = (language: AppLanguage) => {
    setIsClosing(true);
    onSelect(language);
  };

  return (
    <div className={`language-modal-backdrop ${isClosing ? 'language-modal-backdrop--closing' : ''}`}>
      <div className={`language-modal ${isClosing ? 'language-modal--closing' : ''}`}>
        <div className="session-result-modal__badge">Dr. Logo</div>
        <div className="panda-modal-mark mb-3" aria-hidden="true">
          <span className="panda-float-icon">
            <span className="panda-float-icon__face" />
            <span className="panda-float-icon__balloon" />
          </span>
        </div>
        <h2 className="language-modal__title">{languagePrompt.title}</h2>
        <p className="language-modal__subtitle">{languagePrompt.subtitle}</p>
        <div className="language-modal__choices">
          {(['ru', 'uk'] as AppLanguage[]).map((language) => (
            <button
              key={language}
              type="button"
              onClick={() => chooseLanguage(language)}
              className="language-modal__button"
            >
              {languageLabels[language]}
            </button>
          ))}
        </div>
        <p className="language-modal__helper">{languagePrompt.helper}</p>
        <p className="language-modal__helper language-modal__helper--uk">{languagePrompt.helperUk}</p>
      </div>
    </div>
  );
};
