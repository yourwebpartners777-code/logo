import { AppSettings, TranscriptionItem, UserData, VoiceSessionStatus } from '../types';
import { blobToDataUrl } from '../utils/audio-helpers';
import { voiceCopy } from '../i18n';
import { apiKeys } from '../api-keys';
import { loadSessionProgressForUser } from './session-history';
import { CoursePlan, loadCoursePlan } from './subscription-gate';

interface StartVoiceSessionParams {
  settings: AppSettings;
  userData: UserData;
  authToken: string;
  onStatusChange: (status: VoiceSessionStatus) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  onTurnChange?: (turn: 'model' | 'user') => void;
  onSketchText?: (text: string) => void;
  onTranscriptionTurn: (items: TranscriptionItem[]) => void;
  onError: (message: string, status?: VoiceSessionStatus) => void;
  onEnd: () => void;
  initialPrompt?: string;
}

interface VoiceSessionController {
  close: () => Promise<void>;
}

interface DashboardGreetingParams {
  settings: AppSettings;
  userData: UserData;
  authToken: string;
}

export interface DashboardGreetingClip {
  dataUrl: string;
  mimeType: string;
  text: string;
}

export async function startVoiceSession(params: StartVoiceSessionParams): Promise<VoiceSessionController> {
  activeVoiceSessionStartId += 1;
  const startId = activeVoiceSessionStartId;

  if (activeVoiceSession) {
    await activeVoiceSession.close();
    activeVoiceSession = null;
  }

  const session = await startOpenAiVoiceSession(params);

  if (startId !== activeVoiceSessionStartId) {
    await session.close();
    return { close: async () => {} };
  }

  const controller: VoiceSessionController = {
    close: async () => {
      if (activeVoiceSession === controller) {
        activeVoiceSession = null;
      }

      await session.close();
    },
  };

  activeVoiceSession = controller;
  return controller;
}

let activeVoiceSession: VoiceSessionController | null = null;
let activeVoiceSessionStartId = 0;

const formatCoursePlanForPrompt = (plan: CoursePlan | null, language: AppSettings['language']) => {
  if (!plan) {
    return '';
  }

  const phaseLines = plan.phases
    .map((phase, index) => {
      const tasks = phase.tasks.slice(0, 4).join('; ');
      return `${index + 1}. ${phase.title} (${phase.duration}): ${tasks}`;
    })
    .join(' ');
  const nextSteps = plan.nextSteps.slice(0, 4).join('; ');
  const homePractice = plan.homePractice.slice(0, 4).join('; ');

  if (language === 'uk') {
    return [
      `Збережений курс для ${plan.childName}. Дотримуйся саме цього курсу і не перескакуй через етапи.`,
      `Підсумок курсу: ${plan.summary}`,
      `Фокуси роботи: ${plan.focusAreas.join('; ')}.`,
      `Фази курсу: ${phaseLines}.`,
      nextSteps ? `Найближчі кроки: ${nextSteps}.` : '',
      homePractice ? `Домашня практика: ${homePractice}.` : '',
      'У кожній сесії обирай 1 коротке завдання з найближчого незавершеного кроку курсу, чекай відповідь дитини і тільки потім рухайся далі.',
    ].filter(Boolean).join(' ');
  }

  return [
    `Сохраненный курс для ${plan.childName}. Придерживайся именно этого курса и не перескакивай через этапы.`,
    `Итог курса: ${plan.summary}`,
    `Фокусы работы: ${plan.focusAreas.join('; ')}.`,
    `Фазы курса: ${phaseLines}.`,
    nextSteps ? `Ближайшие шаги: ${nextSteps}.` : '',
    homePractice ? `Домашняя практика: ${homePractice}.` : '',
    'В каждой сессии выбирай 1 короткое задание из ближайшего незавершенного шага курса, жди ответ ребенка и только потом двигайся дальше.',
  ].filter(Boolean).join(' ');
};

const buildSessionPlanContext = (settings: AppSettings, userData: UserData) => {
  const progress = loadSessionProgressForUser(userData);
  const savedCoursePlan = loadCoursePlan(userData.email, userData.childName);
  const coursePlanContext = formatCoursePlanForPrompt(savedCoursePlan, settings.language);

  if (settings.language === 'uk') {
    if (progress.stage === 'diagnostics') {
      return [
        'Це перше заняття. Почни діалог сам одразу після запуску, не чекаючи голосу дитини.',
        'Спочатку коротко познайомся: назви себе, звернись до дитини на ім’я і скажи, що радий познайомитися.',
        'Після знайомства простими словами поясни правило лампочки: коли лампочка червона, дитина слухає Dr. Logo; коли лампочка зелена, дитині можна говорити. Попроси дитину дивитися на лампочку, щоб знати свою чергу.',
        'Після пояснення лампочки психологічно розташуй дитину до взаємодії: говори дуже тепло, спокійно, без оцінювання, дай відчути безпеку і право відповідати коротко або просто показати голосом настрій.',
        'Перед вправами постав одне легке питання з вибором, наприклад про улюблену тваринку, колір, гру або казкового героя. Після цього обов’язково зупинись і дочекайся відповіді.',
        'Тільки після першої відповіді або явної паузи м’яко переходь до первинного аналізу мовлення.',
        'Мета першого заняття: м’яко провести первинний аналіз мовлення, помітити можливі складні звуки і в кінці скласти короткий план наступних занять для їх поступового виправлення.',
        'Не став медичних діагнозів. Говори як логопедичний помічник: “я помітив”, “потренуємо”, “план занять”.',
        'Після знайомства проси дитину повторювати короткі склади і слова для перевірки звуків Р, Л, С, З, Ш, Ж, Ч та дихання. Давай по одному завданню за раз.',
        'Після кожного завдання зупинись і чекай відповідь дитини. Не продовжуй діалог сам із собою.',
      ].join(' ');
    }

    return [
      coursePlanContext,
      `Продовжуй збережений план. Завершених занять: ${progress.completedSessions}.`,
      progress.lastSummary ? `Короткий підсумок минулої сесії: ${progress.lastSummary}` : '',
      progress.nextStep ? `Наступний крок: ${progress.nextStep}` : '',
      progress.exitPoint ? `Точка виходу минулої сесії: ${progress.exitPoint}` : '',
      'Почни діалог сам одразу після запуску, не чекаючи голосу дитини.',
      'Після кожного завдання зупинись і чекай відповідь дитини. Не відповідай на власний голос.',
      progress.stage === 'plan'
        ? 'Минуле заняття було первинним аналізом. Коротко нагадай, що сьогодні починаємо план вправ, і дай перше просте завдання.'
        : 'Продовжуй тренування з того етапу, на якому завершили минулу сесію. Коротко нагадай попередній крок і дай наступну вправу.',
    ].filter(Boolean).join(' ');
  }

  if (progress.stage === 'diagnostics') {
    return [
      'Это первое занятие. Начни диалог сам сразу после запуска, не дожидаясь голоса ребенка.',
      'Сначала коротко познакомься: назови себя, обратись к ребенку по имени и скажи, что рад познакомиться.',
      'После знакомства простыми словами объясни правило лампочки: когда лампочка красная, ребенок слушает Dr. Logo; когда лампочка зеленая, ребенку можно говорить. Попроси ребенка смотреть на лампочку, чтобы знать свою очередь.',
      'После объяснения лампочки психологически расположи ребенка к взаимодействию: говори очень тепло, спокойно, без оценивания, дай почувствовать безопасность и право отвечать коротко или просто голосом показать настроение.',
      'Перед упражнениями задай один легкий вопрос с выбором, например про любимое животное, цвет, игру или сказочного героя. После этого обязательно остановись и дождись ответа.',
      'Только после первого ответа или явной паузы мягко переходи к первичному анализу речи.',
      'Цель первого занятия: мягко провести первичный анализ речи, заметить возможные сложные звуки и в конце составить короткий план следующих занятий для их постепенного исправления.',
      'Не ставь медицинских диагнозов. Говори как логопедический помощник: “я заметил”, “потренируем”, “план занятий”.',
      'После знакомства проси ребенка повторять короткие слоги и слова для проверки звуков Р, Л, С, З, Ш, Ж, Ч и дыхания. Давай по одному заданию за раз.',
      'После каждого задания остановись и жди ответ ребенка. Не продолжай диалог сам с собой.',
    ].join(' ');
  }

  return [
    coursePlanContext,
    `Продолжай сохраненный план. Завершенных занятий: ${progress.completedSessions}.`,
    progress.lastSummary ? `Краткое резюме прошлой сессии: ${progress.lastSummary}` : '',
    progress.nextStep ? `Следующий шаг: ${progress.nextStep}` : '',
    progress.exitPoint ? `Точка выхода прошлой сессии: ${progress.exitPoint}` : '',
    'Начни диалог сам сразу после запуска, не дожидаясь голоса ребенка.',
    'После каждого задания остановись и жди ответ ребенка. Не отвечай на собственный голос.',
    progress.stage === 'plan'
      ? 'Прошлое занятие было первичным анализом. Коротко напомни, что сегодня начинаем план упражнений, и дай первое простое задание.'
      : 'Продолжай тренировку с того этапа, на котором завершили прошлую сессию. Коротко напомни предыдущий шаг и дай следующее упражнение.',
  ].filter(Boolean).join(' ');
};

const buildSessionOpeningPrompt = (settings: AppSettings, userData: UserData) => {
  const progress = loadSessionProgressForUser(userData);
  const savedCoursePlan = loadCoursePlan(userData.email, userData.childName);

  if (settings.language === 'uk') {
    return progress.stage === 'diagnostics'
      ? `Почни першу сесію зараз. Скажи дитині теплим жіночим голосом, неквапливо і дуже доброзичливо: "Привіт, ${userData.childName.trim()}! Я Dr. Logo. Рада з тобою познайомитися. Спочатку маленьке правило: дивись на лампочку. Коли вона червона, слухай мене, а коли зелена - твоя черга говорити. Тут можна не хвилюватися: ми просто пограємо голосом, а я тебе уважно послухаю. Скажи, хто тобі більше подобається: панда, котик чи дракон?" Потім зупинись і чекай відповідь дитини. Не давай вправу до відповіді або короткої паузи.`
      : `Почни продовження заняття зараз. Скажи дитині рівно дружнім голосом: "Привіт, ${userData.childName.trim()}! Продовжуємо з того місця, де зупинилися." ${savedCoursePlan ? `Сьогодні тримайся курсу: ${savedCoursePlan.focusAreas.slice(0, 2).join(', ')}.` : ''} ${progress.exitPoint ? `Орієнтир для продовження: ${progress.exitPoint}` : 'Коротко повтори попередній крок.'} Потім дай одне коротке завдання і чекай відповідь.`;
  }

  return progress.stage === 'diagnostics'
    ? `Начни первую сессию сейчас. Скажи ребенку теплым женским голосом, неторопливо и очень доброжелательно: "Привет, ${userData.childName.trim()}! Я Dr. Logo. Рада с тобой познакомиться. Сначала маленькое правило: смотри на лампочку. Когда она красная, слушай меня, а когда зеленая - твоя очередь говорить. Здесь можно не волноваться: мы просто поиграем голосом, а я тебя внимательно послушаю. Скажи, кто тебе больше нравится: панда, котик или дракон?" Затем остановись и жди ответ ребенка. Не давай упражнение до ответа или короткой паузы.`
    : `Начни продолжение занятия сейчас. Скажи ребенку ровно дружелюбным голосом: "Привет, ${userData.childName.trim()}! Продолжаем с того места, где остановились." ${savedCoursePlan ? `Сегодня держись курса: ${savedCoursePlan.focusAreas.slice(0, 2).join(', ')}.` : ''} ${progress.exitPoint ? `Ориентир для продолжения: ${progress.exitPoint}` : 'Коротко повтори предыдущий шаг.'} Затем дай одно короткое задание и жди ответ.`;
};

export async function createDashboardGreetingClip({ settings, userData, authToken }: DashboardGreetingParams): Promise<DashboardGreetingClip> {
  const copy = voiceCopy[settings.language];
  const text = copy.dashboardGreeting(userData.childName, userData.childGender);
  const instructions = [
    copy.dashboardGreetingInstruction,
    copy.systemInstruction(userData.childName, userData.childAge, userData.childGender),
    settings.language === 'uk'
      ? 'Використовуй той самий теплий жіночий голос, темп і манеру, що й під час голосового заняття. Скажи тільки задану фразу.'
      : 'Используй тот же теплый женский голос, темп и манеру, что и во время голосового занятия. Скажи только заданную фразу.',
  ].join('\n\n');

  return createOpenAiDashboardGreetingClip(settings, instructions, text, authToken);
}

async function createOpenAiDashboardGreetingClip(
  settings: AppSettings,
  instructions: string,
  text: string,
  authToken: string,
): Promise<DashboardGreetingClip> {
  const copy = voiceCopy[settings.language];

  const response = await fetch('/api/dashboard-greeting-audio', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text, language: settings.language, instructions }),
  });

  if (!response.ok) {
    throw new Error((await response.json().catch(() => ({}))).error || copy.openAiConnectionError);
  }

  const audioBlob = await response.blob();
  const dataUrl = await blobToDataUrl(audioBlob);

  return { dataUrl, mimeType: audioBlob.type || 'audio/mpeg', text };
}

async function startOpenAiVoiceSession({
  settings,
  userData,
  authToken,
  onStatusChange,
  onSpeakingChange,
  onTurnChange,
  onSketchText,
  onTranscriptionTurn,
  onError,
  onEnd,
}: StartVoiceSessionParams): Promise<VoiceSessionController> {
  const copy = voiceCopy[settings.language];
  const sketchInstruction = settings.language === 'uk'
    ? 'Коли в грі з’являються тварини, казкові герої, бажання дитини, іграшки, подарунки, машини, ракети або роботи, називай ці предмети простими явними словами. Це допомагає екрану швидко малювати відповідний начерк.'
    : 'Когда в игре появляются животные, сказочные герои, желания ребенка, игрушки, подарки, машины, ракеты или роботы, называй эти предметы простыми явными словами. Это помогает экрану быстро рисовать подходящий набросок.';

  return startOpenAiRealtimeSession({
    settings,
    authToken,
    instructions: `${copy.systemInstruction(userData.childName, userData.childAge, userData.childGender)}\n\n${buildSessionPlanContext(settings, userData)}\n\n${sketchInstruction}`,
    initialPrompt: buildSessionOpeningPrompt(settings, userData),
    useMicrophone: true,
    onStatusChange,
    onSpeakingChange,
    onTurnChange,
    onSketchText,
    onTranscriptionTurn,
    onError,
    onEnd,
  });
}

interface OpenAiRealtimeSessionParams {
  settings: AppSettings;
  authToken: string;
  instructions: string;
  initialPrompt?: string;
  useMicrophone: boolean;
  onStatusChange?: (status: VoiceSessionStatus) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onTurnChange?: (turn: 'model' | 'user') => void;
  onSketchText?: (text: string) => void;
  onTranscriptionTurn?: (items: TranscriptionItem[]) => void;
  onError?: (message: string, status?: VoiceSessionStatus) => void;
  onEnd?: () => void;
}

async function startOpenAiRealtimeSession({
  settings,
  authToken,
  instructions,
  initialPrompt,
  useMicrophone,
  onStatusChange,
  onSpeakingChange,
  onTurnChange,
  onSketchText,
  onTranscriptionTurn,
  onError,
  onEnd,
}: OpenAiRealtimeSessionParams): Promise<VoiceSessionController> {
  const copy = voiceCopy[settings.language];

  const pc = new RTCPeerConnection();
  const dataChannel = pc.createDataChannel('oai-events');
  const audioElement = document.createElement('audio');
  const mediaStream = useMicrophone ? await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  }) : null;

  audioElement.autoplay = true;
  audioElement.style.display = 'none';
  document.body.appendChild(audioElement);

  mediaStream?.getTracks().forEach((track) => {
    pc.addTrack(track, mediaStream);
  });

  if (!mediaStream) {
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }

  let closed = false;
  let outputTranscript = '';
  let lastCommittedOutputTranscript = '';
  let hasAudioLevelMonitor = false;
  let audioLevelFrame = 0;
  let outputAudioContext: AudioContext | null = null;
  let micEnableTimer: number | null = null;
  let userTurnFallbackTimer: number | null = null;
  let isModelAudioPlaying = false;
  let modelAudioStarted = false;
  let pendingUserTurnAfterSpeech = false;

  const setMicrophoneEnabled = (enabled: boolean) => {
    if (!mediaStream) {
      return;
    }

    mediaStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const pauseMicrophoneForModelSpeech = () => {
    if (!useMicrophone) {
      return;
    }

    if (micEnableTimer !== null) {
      window.clearTimeout(micEnableTimer);
      micEnableTimer = null;
    }

    setMicrophoneEnabled(false);
  };

  const resumeMicrophoneAfterModelSpeech = () => {
    if (!useMicrophone) {
      return;
    }

    if (micEnableTimer !== null) {
      window.clearTimeout(micEnableTimer);
    }

    micEnableTimer = window.setTimeout(() => {
      setMicrophoneEnabled(true);
      micEnableTimer = null;
    }, 420);
  };

  const clearUserTurnFallback = () => {
    if (userTurnFallbackTimer !== null) {
      window.clearTimeout(userTurnFallbackTimer);
      userTurnFallbackTimer = null;
    }
  };

  const completeModelTurnAfterAudio = () => {
    if (!pendingUserTurnAfterSpeech || closed) {
      return;
    }

    pendingUserTurnAfterSpeech = false;
    clearUserTurnFallback();
    resumeMicrophoneAfterModelSpeech();

    if (useMicrophone) {
      onTurnChange?.('user');
    }
  };

  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    onSpeakingChange?.(false);
    clearUserTurnFallback();
    if (micEnableTimer !== null) {
      window.clearTimeout(micEnableTimer);
      micEnableTimer = null;
    }
    dataChannel.close();
    pc.getSenders().forEach((sender) => sender.track?.stop());
    mediaStream?.getTracks().forEach((track) => track.stop());
    pc.close();
    audioElement.pause();
    audioElement.remove();
    window.cancelAnimationFrame(audioLevelFrame);
    await outputAudioContext?.close();
  };

  const startOutputAudioLevelMonitor = (stream: MediaStream) => {
    if (hasAudioLevelMonitor) {
      return;
    }

    hasAudioLevelMonitor = true;
    outputAudioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const source = outputAudioContext.createMediaStreamSource(stream);
    const analyser = outputAudioContext.createAnalyser();
    const levels = new Uint8Array(analyser.fftSize);
    let quietFrames = 0;
    let speaking = false;

    analyser.fftSize = 512;
    source.connect(analyser);

    const updateSpeakingFromAudio = () => {
      if (closed) {
        return;
      }

      analyser.getByteTimeDomainData(levels);
      let sum = 0;

      for (const level of levels) {
        const centered = level - 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / levels.length);
      const nextSpeaking = rms > 4.8;

      if (nextSpeaking) {
        quietFrames = 0;
        isModelAudioPlaying = true;
        modelAudioStarted = true;
        if (!speaking) {
          speaking = true;
          onSpeakingChange?.(true);
        }
      } else {
        quietFrames += 1;
        if (speaking && quietFrames > 10) {
          speaking = false;
          isModelAudioPlaying = false;
          onSpeakingChange?.(false);
          completeModelTurnAfterAudio();
        }
      }

      audioLevelFrame = window.requestAnimationFrame(updateSpeakingFromAudio);
    };

    updateSpeakingFromAudio();
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    audioElement.srcObject = stream;
    startOutputAudioLevelMonitor(stream);
  };

  pc.onconnectionstatechange = () => {
    if (closed) {
      return;
    }

    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      onError?.(copy.openAiConnectionError);
    }

    if (pc.connectionState === 'closed') {
      onEnd?.();
    }
  };

  dataChannel.addEventListener('open', () => {
    onStatusChange?.('active');

    if (initialPrompt) {
      onTurnChange?.('model');
      pauseMicrophoneForModelSpeech();
      dataChannel.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: initialPrompt,
            },
          ],
        },
      }));
      dataChannel.send(JSON.stringify({
        type: 'response.create',
        response: {
          output_modalities: ['audio'],
        },
      }));
    }
  });

  dataChannel.addEventListener('message', (event) => {
    const serverEvent = JSON.parse(event.data);
    const findTranscriptInContent = (content: unknown): string => {
      if (!Array.isArray(content)) {
        return '';
      }

      return content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }

          const value = item as { transcript?: unknown; text?: unknown };
          return String(value.transcript || value.text || '').trim();
        })
        .filter(Boolean)
        .join(' ');
    };
    const commitModelTranscript = (value: unknown) => {
      const transcript = String(value || outputTranscript || '').trim();

      if (!transcript || transcript === lastCommittedOutputTranscript) {
        outputTranscript = '';
        return;
      }

      lastCommittedOutputTranscript = transcript;
      outputTranscript = '';
      onSketchText?.(transcript);
      onTranscriptionTurn?.([{ speaker: 'model', text: transcript }]);
    };

    if (serverEvent.type === 'error') {
      console.error('OpenAI Realtime error:', serverEvent.error);
      onError?.(serverEvent.error?.message || copy.openAiConnectionError);
      return;
    }

    if (serverEvent.type === 'response.created') {
      pendingUserTurnAfterSpeech = false;
      modelAudioStarted = false;
      clearUserTurnFallback();
      onTurnChange?.('model');
      pauseMicrophoneForModelSpeech();
      if (!hasAudioLevelMonitor) {
        onSpeakingChange?.(true);
      }
    }

    if (serverEvent.type === 'response.audio.delta') {
      onTurnChange?.('model');
      pauseMicrophoneForModelSpeech();
      if (!hasAudioLevelMonitor) {
        onSpeakingChange?.(true);
      }
    }

    if (serverEvent.type === 'conversation.item.input_audio_transcription.completed' && serverEvent.transcript) {
      onSketchText?.(serverEvent.transcript);
      onTranscriptionTurn?.([{ speaker: 'user', text: serverEvent.transcript }]);
    }

    if ((serverEvent.type === 'response.audio_transcript.delta' || serverEvent.type === 'response.output_audio_transcript.delta' || serverEvent.type === 'response.text.delta') && serverEvent.delta) {
      onSketchText?.(serverEvent.delta);
      outputTranscript += serverEvent.delta;
    }

    if (serverEvent.type === 'response.audio_transcript.done' || serverEvent.type === 'response.output_audio_transcript.done' || serverEvent.type === 'response.text.done') {
      commitModelTranscript(serverEvent.transcript);
    }

    if (serverEvent.type === 'response.output_item.done') {
      const content = serverEvent.item?.content || [];
      const audioContent = Array.isArray(content)
        ? content.find((item) => item?.type === 'audio' && (item.transcript || item.text))
        : null;
      commitModelTranscript(audioContent?.transcript || audioContent?.text);
    }

    if (serverEvent.type === 'response.done') {
      const output = serverEvent.response?.output;
      const responseTranscript = Array.isArray(output)
        ? output.map((item) => findTranscriptInContent(item?.content)).filter(Boolean).join(' ')
        : '';

      commitModelTranscript(responseTranscript);

      pendingUserTurnAfterSpeech = useMicrophone;

      if (!hasAudioLevelMonitor) {
        onSpeakingChange?.(false);
        userTurnFallbackTimer = window.setTimeout(() => {
          completeModelTurnAfterAudio();
        }, 520);
      } else if (modelAudioStarted && !isModelAudioPlaying) {
        userTurnFallbackTimer = window.setTimeout(() => {
          completeModelTurnAfterAudio();
        }, 180);
      } else {
        clearUserTurnFallback();
        userTurnFallbackTimer = window.setTimeout(() => {
          completeModelTurnAfterAudio();
        }, 5200);
      }

      if (!useMicrophone) {
        window.setTimeout(() => void close(), 450);
      }
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const formData = new FormData();
  formData.set('sdp', offer.sdp || '');
  formData.set('session', JSON.stringify({
    type: 'realtime',
    model: 'gpt-realtime',
    instructions,
    output_modalities: ['audio'],
    audio: {
      input: {
        transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: settings.language,
        },
        turn_detection: useMicrophone
          ? {
              type: 'server_vad',
              interrupt_response: true,
              create_response: true,
            }
          : null,
      },
      output: {
        voice: 'marin',
      },
    },
  }));

  const sdpResponse = await fetch(apiKeys.openAiTokenEndpoint || '/api/openai/realtime/calls', {
    method: 'POST',
    headers: { authorization: `Bearer ${authToken}` },
    body: formData,
  });

  if (!sdpResponse.ok) {
    const message = await sdpResponse.text();
    await close();
    throw new Error(message || copy.openAiConnectionError);
  }

  await pc.setRemoteDescription({
    type: 'answer',
    sdp: await sdpResponse.text(),
  });

  return { close };
}
