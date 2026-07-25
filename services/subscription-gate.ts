import { AppLanguage, TranscriptionItem, UserData } from '../types';

const COURSE_PLAN_STORAGE_KEY = 'dr_logo_course_plan';

export interface CoursePlan {
  email: string;
  language: AppLanguage;
  childName: string;
  createdAt: string;
  summary: string;
  analysisNotes: string[];
  focusAreas: string[];
  phases: Array<{
    title: string;
    duration: string;
    tasks: string[];
  }>;
  nextSteps: string[];
  homePractice: string[];
}

const normalizePlanPart = (value: string) => value.trim().toLowerCase();
const getPlanKey = (email: string, childName: string) => `${COURSE_PLAN_STORAGE_KEY}:${normalizePlanPart(email)}:${normalizePlanPart(childName)}`;

interface SpeechTarget {
  id: string;
  ruName: string;
  ukName: string;
  ruFocus: string;
  ukFocus: string;
  pattern: RegExp;
  ruTasks: string[];
  ukTasks: string[];
}

const speechTargets: SpeechTarget[] = [
  {
    id: 'r',
    ruName: 'звук Р',
    ukName: 'звук Р',
    ruFocus: 'Постановка и автоматизация звука Р',
    ukFocus: 'Постановка й автоматизація звука Р',
    pattern: /звук\s*р|ры|ра|ро|ру|ре|ри|рак|рыба|тра|дра|гром|тигр|р-р/iu,
    ruTasks: ['Подготовить вибрацию языка через короткие слоги', 'Отработать Р в слогах ра-ро-ру', 'Перейти к словам: рак, рыба, тигр'],
    ukTasks: ['Підготувати вібрацію язика через короткі склади', 'Відпрацювати Р у складах ра-ро-ру', 'Перейти до слів: рак, риба, тигр'],
  },
  {
    id: 'l',
    ruName: 'звук Л',
    ukName: 'звук Л',
    ruFocus: 'Четкий подъем языка для звука Л',
    ukFocus: 'Чіткий підйом язика для звука Л',
    pattern: /звук\s*л|ла|ло|лу|лы|ле|ли|лап|луна|лиса|лев/iu,
    ruTasks: ['Проверить положение языка за верхними зубами', 'Повторять ла-ло-лу без ускорения', 'Закрепить Л в словах: лапа, луна, лиса'],
    ukTasks: ['Перевірити положення язика за верхніми зубами', 'Повторювати ла-ло-лу без прискорення', 'Закріпити Л у словах: лапа, луна, лисиця'],
  },
  {
    id: 'sibilants',
    ruName: 'свистящие С/З',
    ukName: 'свистячі С/З',
    ruFocus: 'Свистящие звуки С и З',
    ukFocus: 'Свистячі звуки С і З',
    pattern: /звук\s*[сз]|са|со|су|сы|за|зо|зу|сыс|свист|заяц|собак|сон/iu,
    ruTasks: ['Удерживать улыбку и узкую воздушную струю', 'Повторять са-со-су и за-зо-зу', 'Закрепить звук в коротких словах и фразах'],
    ukTasks: ['Утримувати усмішку й вузький струмінь повітря', 'Повторювати са-со-су і за-зо-зу', 'Закріпити звук у коротких словах і фразах'],
  },
  {
    id: 'hushing',
    ruName: 'шипящие Ш/Ж/Ч',
    ukName: 'шиплячі Ш/Ж/Ч',
    ruFocus: 'Шипящие звуки Ш, Ж и Ч',
    ukFocus: 'Шиплячі звуки Ш, Ж і Ч',
    pattern: /звук\s*[шжч]|ша|шо|шу|жи|же|чу|ча|шип|жук|шар|чаш/iu,
    ruTasks: ['Развести свистящие и шипящие по положению губ', 'Повторять ша-шо-шу и жа-жо-жу', 'Закрепить в словах: шар, жук, чашка'],
    ukTasks: ['Розвести свистячі й шиплячі за положенням губ', 'Повторювати ша-шо-шу і жа-жо-жу', 'Закріпити у словах: шар, жук, чашка'],
  },
];

const getTranscriptText = (transcript: TranscriptionItem[]) => transcript
  .map((item) => item.text || '')
  .join(' ')
  .toLowerCase();

const getChildTurns = (transcript: TranscriptionItem[]) => transcript
  .filter((item) => item.speaker === 'user' && item.text.trim());

const getModelTurns = (transcript: TranscriptionItem[]) => transcript
  .filter((item) => item.speaker === 'model' && item.text.trim());

const detectSpeechTargets = (transcript: TranscriptionItem[]) => {
  const text = getTranscriptText(transcript);
  return speechTargets.filter((target) => target.pattern.test(text));
};

export const isDiagnosticAnalysisComplete = (transcript: TranscriptionItem[]) => {
  const childTurns = getChildTurns(transcript);
  const modelTurns = getModelTurns(transcript);
  const targets = detectSpeechTargets(transcript);
  const text = getTranscriptText(transcript);
  const hasDiagnosticPrompt = /повтори|скажи|произнеси|вимови|дих|дых|артикуляц|язык|язик|губ|звук/iu.test(text);

  return childTurns.length >= 3 && modelTurns.length >= 3 && targets.length >= 1 && hasDiagnosticPrompt;
};

const detectSupportAreas = (transcript: TranscriptionItem[], language: AppLanguage) => {
  const text = getTranscriptText(transcript);
  const childTurns = getChildTurns(transcript);
  const areas: string[] = [];

  if (/вдох|выдох|дых|дуй|дих|вдих|видих/iu.test(text)) {
    areas.push(language === 'uk' ? 'Мовленнєве дихання' : 'Речевое дыхание');
  }

  if (/улыбк|трубочк|язык|губ|усміш|язик/iu.test(text)) {
    areas.push(language === 'uk' ? 'Артикуляційна підготовка' : 'Артикуляционная подготовка');
  }

  const shortAnswers = childTurns.filter((item) => item.text.trim().split(/\s+/).length <= 2).length;
  if (childTurns.length > 0 && shortAnswers / childTurns.length >= 0.6) {
    areas.push(language === 'uk' ? 'Розгорнутість відповіді' : 'Развернутость ответа');
  }

  return areas;
};

const buildPersonalizedAnalysis = (transcript: TranscriptionItem[], language: AppLanguage) => {
  const childTurns = getChildTurns(transcript);
  const modelTurns = getModelTurns(transcript);
  const detectedTargets = detectSpeechTargets(transcript);
  const supportAreas = detectSupportAreas(transcript, language);
  const targetNames = detectedTargets.map((target) => language === 'uk' ? target.ukName : target.ruName);
  const focusAreas = [
    ...detectedTargets.map((target) => language === 'uk' ? target.ukFocus : target.ruFocus),
    ...supportAreas,
  ];

  const analysisNotes = language === 'uk'
    ? [
      `У первинному аналізі збережено ${childTurns.length} відповідей дитини і ${modelTurns.length} реплік Dr. Logo.`,
      targetNames.length
        ? `Під час заняття перевірялися: ${targetNames.join(', ')}. Саме вони взяті в основу курсу.`
        : 'У транскрипті не вистачило явних проб на конкретні звуки, тому курс не можна вважати завершеним.',
      supportAreas.length
        ? `Додатково помітні напрями підготовки: ${supportAreas.join(', ')}.`
        : 'Додаткові напрями будуть уточнюватися на наступному занятті.',
      'Це не медичний діагноз, а робочий логопедичний план за даними цього сеансу.',
    ]
    : [
      `В первичном анализе сохранено ${childTurns.length} ответов ребенка и ${modelTurns.length} реплик Dr. Logo.`,
      targetNames.length
        ? `Во время занятия проверялись: ${targetNames.join(', ')}. Именно они взяты в основу курса.`
        : 'В транскрипте не хватило явных проб на конкретные звуки, поэтому курс нельзя считать завершенным.',
      supportAreas.length
        ? `Дополнительно видны направления подготовки: ${supportAreas.join(', ')}.`
        : 'Дополнительные направления будут уточняться на следующем занятии.',
      'Это не медицинский диагноз, а рабочий логопедический план по данным этого сеанса.',
    ];

  return { detectedTargets, supportAreas, focusAreas, analysisNotes };
};

export const buildCoursePlan = ({
  userData,
  language,
  transcript,
}: {
  userData: UserData;
  language: AppLanguage;
  transcript: TranscriptionItem[];
}): CoursePlan => {
  const childTurns = transcript.filter((item) => item.speaker === 'user').length;
  const hasSpeech = childTurns > 0;
  const analysis = buildPersonalizedAnalysis(transcript, language);
  const targetTasks = analysis.detectedTargets.flatMap((target) => language === 'uk' ? target.ukTasks : target.ruTasks);
  const focusAreas = analysis.focusAreas.length
    ? analysis.focusAreas
    : [language === 'uk' ? 'Повторна м’яка діагностика мовлення' : 'Повторная мягкая диагностика речи'];
  const primaryFocus = focusAreas[0];
  const nextSteps = language === 'uk'
    ? [
      `На наступному занятті почати саме з напряму: ${primaryFocus}.`,
      analysis.detectedTargets.length
        ? `Дати короткі проби для ${analysis.detectedTargets.map((target) => target.ukName).join(', ')} і не переходити далі, поки відповідь не стане стабільнішою.`
        : 'Спочатку добрати мовні проби, яких не вистачило в аналізі.',
      analysis.supportAreas.length
        ? `Перед звуками зробити підготовку: ${analysis.supportAreas.join(', ')}.`
        : 'Після першої стабільної відповіді перейти до складів і коротких слів.',
    ]
    : [
      `На следующем занятии начать именно с направления: ${primaryFocus}.`,
      analysis.detectedTargets.length
        ? `Дать короткие пробы для ${analysis.detectedTargets.map((target) => target.ruName).join(', ')} и не переходить дальше, пока ответ не станет стабильнее.`
        : 'Сначала добрать речевые пробы, которых не хватило в анализе.',
      analysis.supportAreas.length
        ? `Перед звуками сделать подготовку: ${analysis.supportAreas.join(', ')}.`
        : 'После первого стабильного ответа перейти к слогам и коротким словам.',
    ];

  if (language === 'uk') {
    return {
      email: userData.email,
      language,
      childName: userData.childName,
      createdAt: new Date().toISOString(),
      summary: hasSpeech
        ? `Після первинного заняття для ${userData.childName} складено курс за фактичними пробами з сеансу: ${focusAreas.slice(0, 3).join(', ')}.`
        : `Перший контакт був коротким, тому курс починається з м’якої діагностики і простих повторень, щоб дитина звикла відповідати голосом.`,
      analysisNotes: analysis.analysisNotes,
      focusAreas,
      phases: [
        { title: 'Уточнення виявлених труднощів', duration: '1 заняття', tasks: [`Повторити проби: ${focusAreas.slice(0, 2).join(', ')}`, 'Записати, які склади дитині даються легше', 'Не переходити до швидких фраз до стабільного повторення'] },
        { title: 'Підготовка артикуляції та дихання', duration: '2-4 заняття', tasks: ['Короткий видих без напруження', 'Губи: усмішка і трубочка', 'Язик: підйом, розслаблення і точне положення'] },
        { title: 'Робота з виявленими звуками', duration: '4-10 занять', tasks: targetTasks.length ? targetTasks.slice(0, 6) : ['Повторити короткі склади', 'Визначити перший стабільний звук', 'Переходити від складів до слів'] },
        { title: 'Закріплення в живому мовленні', duration: 'постійно', tasks: ['Міні-діалоги з потрібними словами', 'Ігрові фрази за інтересами дитини', 'Контроль чіткості без тиску і різких виправлень'] },
      ],
      nextSteps,
      homePractice: ['5 хвилин на день', `Повторювати тільки матеріал з курсу: ${focusAreas[0]}`, 'Хвалити за спробу, не виправляти різко'],
    };
  }

  return {
    email: userData.email,
    language,
    childName: userData.childName,
    createdAt: new Date().toISOString(),
    summary: hasSpeech
      ? `После первичного занятия для ${userData.childName} составлен курс по фактическим пробам из сеанса: ${focusAreas.slice(0, 3).join(', ')}.`
      : `Первый контакт был коротким, поэтому курс начинается с мягкой диагностики и простых повторений, чтобы ребенок привык отвечать голосом.`,
    analysisNotes: analysis.analysisNotes,
    focusAreas,
    phases: [
      { title: 'Уточнение выявленных трудностей', duration: '1 занятие', tasks: [`Повторить пробы: ${focusAreas.slice(0, 2).join(', ')}`, 'Отметить, какие слоги ребенку даются легче', 'Не переходить к быстрым фразам до стабильного повторения'] },
      { title: 'Подготовка артикуляции и дыхания', duration: '2-4 занятия', tasks: ['Короткий выдох без напряжения', 'Губы: улыбка и трубочка', 'Язык: подъем, расслабление и точное положение'] },
      { title: 'Работа с выявленными звуками', duration: '4-10 занятий', tasks: targetTasks.length ? targetTasks.slice(0, 6) : ['Повторить короткие слоги', 'Определить первый стабильный звук', 'Переходить от слогов к словам'] },
      { title: 'Закрепление в живой речи', duration: 'постоянно', tasks: ['Мини-диалоги с нужными словами', 'Игровые фразы по интересам ребенка', 'Контроль четкости без давления и резких исправлений'] },
    ],
    nextSteps,
    homePractice: ['5 минут в день', `Повторять только материал из курса: ${focusAreas[0]}`, 'Хвалить за попытку, не исправлять резко'],
  };
};

export const saveCoursePlan = (plan: CoursePlan) => {
  localStorage.setItem(getPlanKey(plan.email, plan.childName), JSON.stringify(plan));
};

export const loadCoursePlan = (email: string, childName: string): CoursePlan | null => {
  const saved = localStorage.getItem(getPlanKey(email, childName));
  if (!saved) return null;
  try {
    return JSON.parse(saved) as CoursePlan;
  } catch {
    return null;
  }
};
