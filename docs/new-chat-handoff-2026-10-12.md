# Moon Campus: передача в новый чат

Дата: 12 октября 2026. Этот документ отделяет проверенный код от состояния production.

## Сначала прочитать
`AGENTS.md`, `.agents/skills/moon-campus/SKILL.md`, `docs/platform-development-brief.md`, `docs/revision-tests.md`. Исходники важнее старых описаний. Не выдумывать выполненный деплой или восстановленные данные.

## Где проект
Репозиторий https://github.com/alyonazerg/university-learning-hub, ветка доставки `sprint-2-registration`. FastAPI / SQLAlchemy / Alembic / PostgreSQL; статический JS. Учитель `frontend/learning.html`, студент `frontend/revision-test.html`. VPS Beget `/opt/moon-campus`, mooncampus.ru / api.mooncampus.ru. Push не обновляет сервер. В рабочем окружении нет SSH-ключа production и приватных AI-ключей.

## Последняя задача
Запись/загрузка индивидуального ответа и диалога, восстановление после reload, ASR и раздельные предложения оценки; подтверждение авторов реплик без редактирования текста; описательные метрики; обе роли преподавателю; очередь сдавших; нейтральные занятия ожидающим; короткий цветной feedback внутри текста; сохранность существующих оценок. Реализация описана в последних разделах документов выше.

## Неприкосновенные решения
- Мобильный интерфейс и слабый интернет, без лишних кнопок.
- Учитель видит обе роли; студент только собственную, фильтрация серверная.
- Четыре целочисленных критерия 0–5 отдельно для essay, individual, dialogue. Speaking среднее двух частей, .5 вверх. Рейтинг максимум 3, pending не ноль.
- AI только предлагает; учитель явно подтверждает. Старые оценки не менять автоматически, не переносить feedback диалога в индивидуальный.
- Исследовательское согласие без предвыбора до попытки. Отказ не переводит в контроль. В research export только согласившиеся.
- Группы 213/214 Evolve 6, 215/216/217 Evolve 5. Эксперимент 213/215. Emergent vocabulary отдельный по группе.
- Локальный draft эссе восстанавливать до resumeChoice; старый серверный текст не должен стирать свежий локальный.
- Начатые попытки сохраняют snapshot. Новый material не переписывает старые ключи.
- Бумажные архивы по 11 файлов; читаемые 11 pt, preview внутри экспериментальных, согласие, выбор тем эссе, зашифрованные ключи. Не дублировать файлы, не публиковать пароли.

## Чего НЕ считать подтверждённым
Production не обновлялся из этого окружения. Реальные платные ASR/AI-запросы не проверялись. Тесты используют синтетическое аудио и mock провайдера; мобильная проверка браузера не заменяет реальный Safari/iPhone. Последний фрагмент при аварийном закрытии может потеряться. Полная работа offline и межустройственное восстановление незагруженных данных не реализованы. ASR-паузы не доказательство hesitation или эффекта прайминга.

Внешний аудио-AI выключен. Автоматическая проверка отклонила отправку чувствительных данных без согласованного получателя; запрос разрешения на OpenAI был задан, ответа пока нет. Не включать по одному слову «продолжи». Требуется явное разрешение именно на аудио/транскрипты в OpenAI и приватный отдельный ключ. Запись/хранение и ручная оценка доступны без AI.

## Обновление сервера пользователем
```bash
cd /opt/moon-campus
git pull --ff-only origin sprint-2-registration
docker compose -f docker-compose.yml -f compose.beget.yml up -d --build
```
Миграция 019 создаёт таблицу аудио; Docker API добавляет ffmpeg. Перед production upgrade обеспечить обычный backup PostgreSQL, особенно перед накоплением аудио. После обновления проверить `/health`, логи Alembic, две попытки пары, reload эссе/аудио, старые marks и отдельные feedback. Нет основания делать reset БД.

## Следующая практическая проверка
1. Подтвердить установленный commit на VPS и корректность миграции 019.
2. На двух телефонах пройти запись/загрузку, прослушивание и reload; проверить Safari и слабую связь.
3. После явного разрешения и ключа проверить доступность ASR-моделей одной разрешённой тестовой записью; подтвердить роли, получить раздельные suggestions, убедиться, что существующие marks не изменены.
4. Проверить teacher queue и обе карточки, individual/dialogue feedback, ожидание и research export согласие.
5. Оценить ограничение объёма БД/retention и стоимость хранения перед массовой записью; сейчас лимит 12 МиБ на файл, одна запись на часть, аудио в PostgreSQL.

## Проверки этой итерации
- Полный backend: 76 passed; после добавления проверки очереди и последнего ограничения capture metadata — 5 audio/queue tests passed (четыре входят в полный прогон).
- Четыре браузерных набора: 34 passed, включая кабинеты, приватность, reload, сбои сети, аудиофрагменты и immutable transcript.
- Полная Alembic upgrade head на отдельной SQLite: head `019_revision_audio`, таблица создана. Это не проверка миграции production PostgreSQL.
- Синтаксис изменённого JS и git diff --check пройдены. Docker image не собирался, реальная камера/микрофон телефона и платный OpenAI не проверялись.
- Delivery commit: используйте commit последнего изменения этого файла, не исторический b5894fe (это предыдущая защита draft эссе).


### Inline essay annotations — 14 октября 2026

ТЗ пользователя реализуется поверх существующих submissions, AI review и PUT `/learning/revisions/attempts/{id}/review`. Миграция не нужна: `RevisionAttempt.report` хранит `essay_annotation_draft`, `essay_annotation_version`, `essay_feedback_publication`. Точная привязка: original, start/end (Unicode code points, не UTF-16), source hash; ID стабилен для attempt/текста/позиции/category/intent. Недостоверные цитаты, неоднозначные повторы без позиций и malformed annotations отбрасываются.

Ровно три категории **для эссе**: Grammar (включая spelling/punctuation), Vocabulary, Style. Отдельный intent Correction / Improvement / Praise. Praise без replacement. Комментарии AI pending; преподаватель одобряет/отклоняет, редактирует replacement/explanation, смотрит Preview approved student feedback с Overall Feedback. Save essay grade · publish approved feedback публикует только approved и явно отредактированный общий отзыв. Переходящий AI draft никогда не заменяет опубликованный snapshot. Защита от устаревшего набора — source hash/version, HTTP409; criteria/rating/usage остаются прежними. Review и AI review блокируют одну строку на время операции, чтобы новый AI не затёр одновременно сохранённую оценку.

UI: оригинал эссе не переписывается, подчёркнутые фрагменты — кнопки с клавиатурным фокусом. Tap/click открывает короткую панель: категория/intent, original, replacement, explanation. При пересечениях текст разбивается на непересекающиеся интервалы, открываются все относящиеся замечания. Цвет обозначает intent: correction оранжевый, improvement синий, praise зелёный. Рендер только textContent, никакого HTML от AI. Общий отзыв после эссе, целевой объём 40–65 слов, краткая сила/приоритет/следующий шаг, учитель может редактировать.

Legacy grades/teacher_feedback сохранены; прежние AI language_errors доступны учителю как pending при точной уникальной цитате, spelling/punctuation объединены в Grammar. Старые неподтверждённые AI-примеры больше не публикуются автоматически по одному факту наличия оценки. Для утверждения использовать новый редактор. Regrade сохраняет draft/publication. Это изменение эссе, оно не меняет критерии Speaking или его процесс.

Проверка вручную: Results → student → Essay → Check essay with AI (имеющийся приватный ключ). Отметить Approve / Reject, поправить explanation, открыть Preview, затем Save essay grade · publish approved feedback. По приватной ссылке студента обновить результат: видны только approved; текст неизменён. Повторный AI не меняет опубликованный feedback до следующего Save.

Production evidence 14 октября: пользователь прислал Application startup complete и GET attempts 200 после сборки ffmpeg/API и frontend. Это подтверждает запуск API и чтение attempts, не успешный реальный ASR или последний annotations update. Последние inline annotations требуют следующего deploy.

Inline annotations validation 14 октября: 81 backend tests passed; 17 dashboard/student browser tests passed; 3 new mobile/desktop/editor browser tests passed. Дополнительно 3 существующих audio/text-feedback browser tests прошли в первом прогоне. Реальный платный запрос AI для нового формата не выполнялся; провайдер подменён mock в тестах.
