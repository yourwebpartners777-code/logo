import { AppLanguage, UserData } from './types';

export const languageLabels: Record<AppLanguage, string> = {
  ru: 'Русский',
  uk: 'Українська',
};

export const languagePrompt = {
  title: 'Выберите язык',
  subtitle: 'Оберіть мову',
  helper: 'Интерфейс и голосовой доктор будут говорить на выбранном языке',
  helperUk: 'Інтерфейс і голосовий лікар говоритимуть обраною мовою',
};

export const ui = {
  ru: {
    auth: {
      logoAlt: 'Панда-доктор Dr. Logo',
      subtitle: 'Ваш весёлый помощник в мире слов!',
      password: 'Пароль',
      login: 'Войти',
      forgotPassword: 'Забыли пароль?',
      resetTitle: 'Восстановление пароля',
      resetEmailHelp: 'Введите почту, и мы отправим ссылку для восстановления.',
      resetEmailSubmit: 'Отправить ссылку',
      resetEmailSent: 'Если аккаунт найден, письмо со ссылкой уже отправлено.',
      resetEmailUnavailable: 'Отправка писем пока не настроена. Добавьте RESEND_API_KEY на сервере.',
      resetNewPassword: 'Новый пароль',
      resetConfirmSubmit: 'Сохранить пароль',
      resetSuccess: 'Пароль обновлен. Теперь можно войти.',
      resetInvalidLink: 'Ссылка восстановления недействительна или устарела.',
      backToLogin: 'Вернуться ко входу',
      footer: 'Маленькие шаги к большой речи',
    },
    onboarding: {
      title: 'Расскажите о ребенке 🎈',
      subtitle: 'Это поможет нам настроить голосового логопеда',
      childName: 'Имя ребенка',
      childNamePlaceholder: 'Напр. Артем',
      age: 'Возраст',
      ageOption: (age: number) => `${age} лет`,
      gender: 'Пол',
      male: 'Мальчик',
      female: 'Девочка',
      submit: 'Готово, погнали! 🎨',
    },
    dashboard: {
      achievementsTitle: 'Достижения',
      settingsTitle: 'Настройки',
      greeting: (name?: string) => `Привет ${name}`,
      ready: (gender?: UserData['childGender']) => `${gender === 'female' ? 'Готова' : 'Готов'} поиграть с Dr. Logo?`,
      play: 'ЖМИ',
      parentNotice: 'Если у Вас есть микрофон и наушники то перед тем как начать подключите их',
      level: 'Уровень',
      beginner: 'Новичок',
      logoutConfirm: 'Выйти из профиля?',
    },
    achievements: {
      title: 'Достижения 🏆',
      pronunciationWins: 'Победы в произношении',
      history: 'История занятий',
      level: 'Уровень',
      beginner: 'Новичок',
      streak: 'Серия занятий',
      streakValue: '2 дня',
      progress: 'Прогресс речи',
      progressValue: '42%',
      lastSession: 'Последняя игра',
      tags: ['Звук Р', 'Звук Ш', 'Звук Л', 'Четкость', 'Громкость'],
    },
    settings: {
      title: 'Настройки',
      email: 'Почта родителя',
      password: 'Пароль',
      passwordPlaceholder: 'Новый пароль',
      language: 'Язык интерфейса и голоса',
      emailReports: 'Отчеты на почту',
      emailReportsHint: 'Отправлять подробный отчет после каждой голосовой сессии',
      save: 'Сохранить',
      logout: 'Выйти из профиля',
    },
    voice: {
      avatarAlt: 'Панда-доктор Dr. Logo',
      failedStart: 'Не удалось запустить голосовую сессию.',
      connecting: 'Подключаем голосового логопеда...',
      error: 'Ой! Сессия не запустилась.',
      hello: 'Поздоровайся с доктором! 😊',
      speaking: 'Доктор говорит...',
      yourTurn: 'Твой выход! 🎤',
    },
  },
  uk: {
    auth: {
      logoAlt: 'Панда-лікар Dr. Logo',
      subtitle: 'Ваш веселий помічник у світі слів!',
      password: 'Пароль',
      login: 'Увійти',
      forgotPassword: 'Забули пароль?',
      resetTitle: 'Відновлення пароля',
      resetEmailHelp: 'Введіть пошту, і ми надішлемо посилання для відновлення.',
      resetEmailSubmit: 'Надіслати посилання',
      resetEmailSent: 'Якщо акаунт знайдено, лист із посиланням уже надіслано.',
      resetEmailUnavailable: 'Надсилання листів поки не налаштовано. Додайте RESEND_API_KEY на сервері.',
      resetNewPassword: 'Новий пароль',
      resetConfirmSubmit: 'Зберегти пароль',
      resetSuccess: 'Пароль оновлено. Тепер можна увійти.',
      resetInvalidLink: 'Посилання для відновлення недійсне або застаріло.',
      backToLogin: 'Повернутися до входу',
      footer: 'Маленькі кроки до великого мовлення',
    },
    onboarding: {
      title: 'Розкажіть про дитину 🎈',
      subtitle: 'Це допоможе налаштувати голосового логопеда',
      childName: 'Ім’я дитини',
      childNamePlaceholder: 'Напр. Артем',
      age: 'Вік',
      ageOption: (age: number) => `${age} років`,
      gender: 'Стать',
      male: 'Хлопчик',
      female: 'Дівчинка',
      submit: 'Готово, рушаймо! 🎨',
    },
    dashboard: {
      achievementsTitle: 'Досягнення',
      settingsTitle: 'Налаштування',
      greeting: (name?: string) => `Привіт ${name}`,
      ready: (gender?: UserData['childGender']) => `${gender === 'female' ? 'Готова' : 'Готовий'} пограти з Dr. Logo?`,
      play: 'ЖМИ',
      parentNotice: 'Якщо у Вас є мікрофон і навушники, то перед початком підключіть їх',
      level: 'Рівень',
      beginner: 'Новачок',
      logoutConfirm: 'Вийти з профілю?',
    },
    achievements: {
      title: 'Досягнення 🏆',
      pronunciationWins: 'Перемоги у вимові',
      history: 'Історія занять',
      level: 'Рівень',
      beginner: 'Новачок',
      streak: 'Серія занять',
      streakValue: '2 дні',
      progress: 'Прогрес мовлення',
      progressValue: '42%',
      lastSession: 'Остання гра',
      tags: ['Звук Р', 'Звук Ш', 'Звук Л', 'Чіткість', 'Гучність'],
    },
    settings: {
      title: 'Налаштування',
      email: 'Пошта батьків',
      password: 'Пароль',
      passwordPlaceholder: 'Новий пароль',
      language: 'Мова інтерфейсу та голосу',
      emailReports: 'Звіти на пошту',
      emailReportsHint: 'Надсилати детальний звіт після кожної голосової сесії',
      save: 'Зберегти',
      logout: 'Вийти з профілю',
    },
    voice: {
      avatarAlt: 'Панда-лікар Dr. Logo',
      failedStart: 'Не вдалося запустити голосову сесію.',
      connecting: 'Підключаємо голосового логопеда...',
      error: 'Ой! Сесія не запустилася.',
      hello: 'Привітайся з лікарем! 😊',
      speaking: 'Лікар говорить...',
      yourTurn: 'Твоя черга! 🎤',
    },
  },
} as const;

export const getUi = (language: AppLanguage) => ui[language] ?? ui.ru;

export const voiceCopy = {
  ru: {
    openAiConnectionError: 'OpenAI Realtime не подключился. Проверь ключ и доступ к gpt-realtime.',
    dashboardGreetingInstruction: 'Вы - Dr. Logo, ласковый голосовой логопед. Скажите только заданную фразу, мягко и дружелюбно. Не добавляйте других слов.',
    dashboardGreeting: (name: string, gender: UserData['childGender']) => {
      const readyWord = gender === 'female' ? 'готова' : 'готов';
      return `Привет, ${name.trim()}, когда будешь ${readyWord}, просто нажми на мяч.`;
    },
    systemInstruction: (name: string, age: string, gender: UserData['childGender']) => {
      const numericAge = Number.parseInt(age, 10);
      const ageStyle = Number.isFinite(numericAge) && numericAge <= 4
        ? 'Говорите очень простыми фразами по 1-2 предложения, чаще используйте игру, повторение слогов, животных и смешные звуки.'
        : Number.isFinite(numericAge) && numericAge <= 7
          ? 'Говорите коротко, но чуть взрослее: давайте игровые задания, маленькие истории и понятные цели.'
          : 'Говорите уважительно и спокойнее, без сюсюканья: объясняйте цель упражнения и сохраняйте игровой тон.';
      const genderStyle = gender === 'female'
        ? 'Обращайтесь к ребенку в женском роде, если нужна форма рода.'
        : gender === 'male'
          ? 'Обращайтесь к ребенку в мужском роде, если нужна форма рода.'
          : 'Избегайте форм, где нужно выбирать род, если это звучит естественно.';

      return `Вы - Dr. Logo, добрый и спокойный логопед для ребенка по имени ${name} (${age} лет).
Всегда говорите на русском языке. ${ageStyle} ${genderStyle}
Говорите теплым живым голосом, подстраивайте темп под возраст, хвалите за старание, предлагайте игровые упражнения на звуки и дыхание.
Не ставьте диагнозов и не давайте медицинских обещаний. Если ребенок устал, мягко предложите сделать паузу.`;
    },
  },
  uk: {
    openAiConnectionError: 'OpenAI Realtime не підключився. Перевір ключ і доступ до gpt-realtime.',
    dashboardGreetingInstruction: 'Ти - Dr. Logo, лагідний голосовий логопед. Скажи тільки задану фразу, м’яко і дружньо. Не додавай інших слів.',
    dashboardGreeting: (name: string, gender: UserData['childGender']) => {
      const readyWord = gender === 'female' ? 'готова' : 'готовий';
      return `Привіт, ${name.trim()}, коли будеш ${readyWord}, просто натисни на м'яч.`;
    },
    systemInstruction: (name: string, age: string, gender: UserData['childGender']) => {
      const numericAge = Number.parseInt(age, 10);
      const ageStyle = Number.isFinite(numericAge) && numericAge <= 4
        ? 'Говори дуже простими фразами по 1-2 речення, частіше використовуй гру, повторення складів, тварин і смішні звуки.'
        : Number.isFinite(numericAge) && numericAge <= 7
          ? 'Говори коротко, але трохи доросліше: давай ігрові завдання, маленькі історії і зрозумілі цілі.'
          : 'Говори поважно і спокійніше, без сюсюкання: пояснюй мету вправи і зберігай ігровий тон.';
      const genderStyle = gender === 'female'
        ? 'Звертайся до дитини в жіночому роді, якщо потрібна форма роду.'
        : gender === 'male'
          ? 'Звертайся до дитини в чоловічому роді, якщо потрібна форма роду.'
          : 'Уникай форм, де потрібно вибирати рід, якщо це звучить природно.';

      return `Ти - Dr. Logo, добрий і спокійний логопед для дитини на ім'я ${name} (${age} років).
Завжди говори українською мовою. ${ageStyle} ${genderStyle}
Говори теплим живим голосом, підлаштовуй темп під вік, хвали за старання, пропонуй ігрові вправи на звуки та дихання.
Не став діагнозів і не давай медичних обіцянок. Якщо дитина втомилася, м'яко запропонуй зробити паузу.`;
    },
  },
} as const;
