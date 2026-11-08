# Навыки проекта

Навыки установлены в `.agents/skills`, откуда Codex обнаруживает их при работе с проектом.
Их можно вызвать по имени: `$backend-patterns`, `$webapp-testing`, `$verification-loop`.

| Навык | Назначение | Источник и версия |
| --- | --- | --- |
| backend-patterns | Архитектура серверной части и API | [affaan-m/ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/backend-patterns) |
| webapp-testing | Проверка веб-интерфейса через Python Playwright | [anthropics/skills](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/webapp-testing) |
| verification-loop | Проверки после изменений | [affaan-m/ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/verification-loop) |

Файлы навыков скопированы без изменений вместе с лицензиями, скриптами и примерами.
Установка навыков не устанавливает Python Playwright и браузеры: они нужны при запуске браузерных проверок.
Команды сборки, проверки типов, линтера и тестов следует выбирать по фактическому стеку проекта; сейчас проект содержит отдельный HTML-файл.
