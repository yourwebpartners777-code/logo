
import React, { useState } from 'react';
import { getUi } from '../i18n';
import { AppLanguage } from '../types';
import { confirmPasswordReset, requestPasswordReset } from '../services/account-api';

interface AuthScreenProps {
  language: AppLanguage;
  onSuccess: (email: string, password: string) => Promise<void>;
  errorMessage?: string;
  isSubmitting?: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ language, onSuccess, errorMessage, isSubmitting }) => {
  const resetParams = new URLSearchParams(window.location.search);
  const initialResetToken = resetParams.get('resetToken') || '';
  const initialResetEmail = resetParams.get('email') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'requestReset' | 'confirmReset'>(initialResetToken ? 'confirmReset' : 'login');
  const [resetEmail, setResetEmail] = useState(initialResetEmail);
  const [resetPassword, setResetPassword] = useState('');
  const [resetToken] = useState(initialResetToken);
  const [resetStatus, setResetStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const t = getUi(language).auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      await onSuccess(email, password);
    }
  };

  const getResetErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('Email sending is not configured')) {
      return t.resetEmailUnavailable;
    }

    if (message.includes('invalid or expired')) {
      return t.resetInvalidLink;
    }

    return message || 'Reset failed';
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus('');
    setResetError('');
    setIsResetSubmitting(true);

    try {
      await requestPasswordReset(resetEmail);
      setResetStatus(t.resetEmailSent);
    } catch (error) {
      setResetError(getResetErrorMessage(error));
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus('');
    setResetError('');
    setIsResetSubmitting(true);

    try {
      await confirmPasswordReset(resetEmail, resetToken, resetPassword);
      setResetStatus(t.resetSuccess);
      setResetPassword('');
      setMode('login');
      setEmail(resetEmail);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      setResetError(getResetErrorMessage(error));
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const returnToLogin = () => {
    setMode('login');
    setResetStatus('');
    setResetError('');
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const renderLoginForm = () => (
    <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white/90 backdrop-blur-sm p-8 rounded-[2rem] shadow-2xl border-4 border-white">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-blue-50 focus:border-blue-400 focus:ring-0 outline-none transition-all bg-blue-50/30"
            placeholder="example@mail.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">{t.password}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-blue-50 focus:border-blue-400 focus:ring-0 outline-none transition-all bg-blue-50/30"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        {errorMessage && (
          <p className="text-sm font-bold text-red-500 text-center">{errorMessage}</p>
        )}
        {resetStatus && (
          <p className="text-sm font-bold text-green-600 text-center">{resetStatus}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          {isSubmitting ? '...' : t.login}
        </button>
        <button
          type="button"
          className="auth-forgot-password"
          onClick={() => {
            setResetEmail(email);
            setResetStatus('');
            setResetError('');
            setMode('requestReset');
          }}
        >
          {t.forgotPassword}
        </button>
      </div>
    </form>
  );

  const renderResetRequestForm = () => (
    <form onSubmit={handleResetRequest} className="w-full max-w-sm bg-white/90 backdrop-blur-sm p-8 rounded-[2rem] shadow-2xl border-4 border-white">
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="auth-reset-title">{t.resetTitle}</h2>
          <p className="auth-reset-help">{t.resetEmailHelp}</p>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Email</label>
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-blue-50 focus:border-blue-400 focus:ring-0 outline-none transition-all bg-blue-50/30"
            placeholder="example@mail.com"
            required
          />
        </div>
        {resetStatus && (
          <p className="text-sm font-bold text-green-600 text-center">{resetStatus}</p>
        )}
        {resetError && (
          <p className="text-sm font-bold text-red-500 text-center">{resetError}</p>
        )}
        <button
          type="submit"
          disabled={isResetSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          {isResetSubmitting ? '...' : t.resetEmailSubmit}
        </button>
        <button type="button" className="auth-forgot-password" onClick={returnToLogin}>
          {t.backToLogin}
        </button>
      </div>
    </form>
  );

  const renderResetConfirmForm = () => (
    <form onSubmit={handleResetConfirm} className="w-full max-w-sm bg-white/90 backdrop-blur-sm p-8 rounded-[2rem] shadow-2xl border-4 border-white">
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="auth-reset-title">{t.resetTitle}</h2>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Email</label>
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-blue-50 focus:border-blue-400 focus:ring-0 outline-none transition-all bg-blue-50/30"
            placeholder="example@mail.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">{t.resetNewPassword}</label>
          <input
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border-2 border-blue-50 focus:border-blue-400 focus:ring-0 outline-none transition-all bg-blue-50/30"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        {resetError && (
          <p className="text-sm font-bold text-red-500 text-center">{resetError}</p>
        )}
        <button
          type="submit"
          disabled={isResetSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          {isResetSubmitting ? '...' : t.resetConfirmSubmit}
        </button>
        <button type="button" className="auth-forgot-password" onClick={returnToLogin}>
          {t.backToLogin}
        </button>
      </div>
    </form>
  );

  return (
    <div className="auth-screen flex flex-col items-center justify-center p-6 space-y-8 animate-fadeIn relative z-10">
      <div className="text-center">
        <div className="doctor-panda-logo bg-white shadow-2xl inline-flex mb-5 border-4 border-white" aria-label={t.logoAlt}>
          <span className="doctor-panda-logo__cap" />
          <span className="doctor-panda-logo__face" aria-hidden="true" />
          <span className="doctor-panda-logo__coat">
            <span className="doctor-panda-logo__cross">+</span>
          </span>
        </div>
        <h1 className="site-title text-blue-600 mb-2">Dr. Logo</h1>
        <p className="site-subtitle">{t.subtitle}</p>
      </div>
      {mode === 'login' && renderLoginForm()}
      {mode === 'requestReset' && renderResetRequestForm()}
      {mode === 'confirmReset' && renderResetConfirmForm()}
    </div>
  );
};
