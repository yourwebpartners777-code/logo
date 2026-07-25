# Dr. Logo Android

Android APK работает только с сервером этого проекта. Это нативный WebView-клиент, который загружает фиксированный `server.js`/`dist` URL и использует те же API:

- `POST /api/auth/login`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/openai/realtime/calls`
- `POST /api/dashboard-greeting-audio`
- `POST /api/session-report`

Так сохраняется полное совпадение функций с web-приложением: аккаунты, профиль ребенка, настройки, OpenAI Realtime voice session, отчеты, восстановление пароля, localStorage и интерфейс.

## Как работает

Сервер задан в:

```text
android-native/res/values/strings.xml
```

Параметр:

```xml
<string name="project_server_url">http://localhost:3001</string>
```

Этот сервер должен запускать текущий `server.js` и отдавать собранный frontend из `dist`. В APK нет экрана выбора сервера. Долгое нажатие внутри приложения показывает текущий сервер и кнопку обновления.

WebView разрешает навигацию только внутри host, указанного в `project_server_url`. Переходы на другие `http`/`https` хосты блокируются; `mailto:` и `tel:` открываются внешними приложениями.

Для сборки под телефон замените `localhost` на домен проекта или на `http://<ip-компьютера>:3001`, если телефон в той же сети. `localhost` на телефоне указывает на сам телефон, не на компьютер.

## Сборка

```bash
cd android-native
./build.sh
```

Готовый APK:

```text
android-native/dist/dr-logo-native.apk
```

## Проверка на устройстве

```bash
adb install -r android-native/dist/dr-logo-native.apk
adb shell monkey -p com.drlogo.app 1
```

Для голосовых функций нужны разрешение микрофона, Android System WebView/Chrome с поддержкой WebRTC и доступ APK к вашему HTTPS-серверу.
