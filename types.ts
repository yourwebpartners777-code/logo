
export enum AppState {
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  GAME_SESSION = 'GAME_SESSION',
  ACHIEVEMENTS = 'ACHIEVEMENTS',
  SETTINGS = 'SETTINGS'
}

export type AppLanguage = 'ru' | 'uk';

export interface UserData {
  email: string;
  password?: string;
  childName: string;
  childAge: string;
  childGender: 'male' | 'female' | 'other';
}

export interface TranscriptionItem {
  speaker: 'user' | 'model';
  text: string;
}

export interface SessionRecord {
  id: string;
  date: string;
  finishedAt: string;
  duration: string;
  durationSeconds: number;
  turnsCount: number;
  childTurnsCount: number;
  doctorTurnsCount: number;
  storyTitle: string;
  storySummary: string;
  transcript: TranscriptionItem[];
  achievements: string[];
}

export interface AppSettings {
  language: AppLanguage;
  emailReportsEnabled: boolean;
}

export type VoiceSessionStatus =
  | 'connecting'
  | 'active'
  | 'error'
  | 'unsupported';
