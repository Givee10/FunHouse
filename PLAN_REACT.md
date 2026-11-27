# План миграции фронта на React (Vite)

Текущее решение сохранено в ветке `vanilla`. Эта ветка (`main`) — план перехода на React-фронтенд при сохранении бэкенда.

## Цель
Переписать клиентскую часть (страницы `play`, `board`, `admin`) на React + Vite, сохранив сервер (Express + Socket.io + SQLite). Улучшить UX, переиспользование компонентов, типизацию.

## Этапы

### 1. Подготовка (0.5 дня)
- [ ] Создать папку `client/` с Vite + React + TypeScript.
- [ ] Настроить прокси Vite → Express (`/api`, `/socket.io`) для dev.
- [ ] Обновить `package.json`: скрипты `dev:client`, `build:client`, `dev` (concurrently).
- [ ] Добавить `.gitignore` для `client/dist`, `client/node_modules`.

### 2. Бэкенд (без изменений логики) (0.5 дня)
- [ ] Express раздаёт `client/dist` в проде (`app.use(express.static('client/dist'))`).
- [ ] В dev — Vite dev server отдельно.
- [ ] Socket.io остаётся без изменений.

### 3. Компоненты (2-3 дня)
- [ ] `src/hooks/useSocket.ts` — подключение, reconnect, join_game/join_board.
- [ ] `src/hooks/useTimer.ts` — серверный таймер с синхронизацией `serverTime`.
- [ ] `src/components/QuestionCard.tsx` — вопрос + 4 варианта.
- [ ] `src/components/Leaderboard.tsx` — таблица результатов.
- [ ] `src/components/Timer.tsx` — круговой таймер.
- [ ] `src/pages/Play.tsx`, `Board.tsx`, `Admin.tsx`, `Home.tsx`.
- [ ] `src/context/GameContext.tsx` — состояние игры, игрок, PIN.

### 4. Админка (1-2 дня)
- [ ] Формы создания игры, вопросов, ручных баллов.
- [ ] Таблицы с сортировкой/фильтрами.
- [ ] Управление (старт/следующий/стоп) через сокеты.

### 5. Стили (1 день)
- [ ] CSS-модули или Tailwind.
- [ ] Тёмная/светлая тема через CSS-переменные + контекст.

### 6. PWA и офлайн (0.5 дня)
- [ ] `vite-plugin-pwa` вместо ручного SW.
- [ ] Кэш вопросов в IndexedDB.

### 7. Тесты и деплой (1 день)
- [ ] Проверка на телефоне/планшете.
- [ ] Обновление README.
- [ ] Деплой: Vercel (фронт) + Render (бэк) или один Docker.

## Оценка
~5-7 дней работы. Бэкенд не меняется, риски минимальны.

## Что переиспользуется
- Вся серверная логика (`server.js`, `db.js`).
- Протокол сокетов.
- Схема БД.

## Что можно не переносить
- Ручной SW → vite-plugin-pwa.
- Дублирование CSS → модули.