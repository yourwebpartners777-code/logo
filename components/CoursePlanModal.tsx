import React from 'react';
import { CoursePlan } from '../services/subscription-gate';

interface CoursePlanModalProps {
  plan: CoursePlan;
  onContinue: () => void;
}

export const CoursePlanModal: React.FC<CoursePlanModalProps> = ({ plan, onContinue }) => {
  const isUk = plan.language === 'uk';
  const analysisNotes = plan.analysisNotes?.length
    ? plan.analysisNotes
    : [plan.summary];
  const nextSteps = plan.nextSteps?.length
    ? plan.nextSteps
    : plan.phases.flatMap((phase) => phase.tasks).slice(0, 3);

  return (
    <div className="course-modal-backdrop">
      <div className="course-modal">
        <div className="course-modal__badge">Dr. Logo</div>
        <h2 className="course-modal__title">
          {isUk ? `Аналіз і курс для ${plan.childName}` : `Анализ и курс для ${plan.childName}`}
        </h2>
        <p className="course-modal__summary">{plan.summary}</p>

        <div className="course-modal__section">
          <h3>{isUk ? 'Пояснення аналізу' : 'Пояснение анализа'}</h3>
          <ul className="course-modal__analysis">
            {analysisNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>

        <div className="course-modal__section">
          <h3>{isUk ? 'Що показав первинний аналіз' : 'Что показал первичный анализ'}</h3>
          <div className="course-modal__chips">
            {plan.focusAreas.map((area) => (
              <span key={area}>{area}</span>
            ))}
          </div>
        </div>

        <div className="course-modal__section">
          <h3>{isUk ? 'Курс виправлення мовленнєвих дефектів' : 'Курс исправления дефектов речи'}</h3>
          <div className="course-modal__phases">
            {plan.phases.map((phase, index) => (
              <div key={phase.title} className="course-modal__phase">
                <div className="course-modal__phase-index">{index + 1}</div>
                <div>
                  <div className="course-modal__phase-title">{phase.title}</div>
                  <div className="course-modal__phase-duration">{phase.duration}</div>
                  <ul>
                    {phase.tasks.map((task) => <li key={task}>{task}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="course-modal__section">
          <h3>{isUk ? 'Подальші кроки' : 'Дальнейшие шаги'}</h3>
          <ol className="course-modal__steps">
            {nextSteps.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>

        <div className="course-modal__section">
          <h3>{isUk ? 'Домашня практика між заняттями' : 'Домашняя практика между занятиями'}</h3>
          <ul className="course-modal__home">
            {plan.homePractice.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>

        <button type="button" className="course-modal__continue" onClick={onContinue}>
          {isUk ? 'Продовжити' : 'Продолжить'}
        </button>
      </div>
    </div>
  );
};
