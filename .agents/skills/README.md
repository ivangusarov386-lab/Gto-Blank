# Навыки проекта

Навыки установлены в `.agents/skills`, откуда Codex обнаруживает их при работе с проектом.
Их можно вызвать по имени: `$backend-patterns`, `$webapp-testing`, `$verification-loop`, `$3d-website-architect`, `$click-path-audit`, `$frontend-a11y`, `$frontend-design-direction`.

| Навык | Назначение | Источник и версия |
| --- | --- | --- |
| backend-patterns | Архитектура серверной части и API | [affaan-m/ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/backend-patterns) |
| webapp-testing | Проверка веб-интерфейса через Python Playwright | [anthropics/skills](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/webapp-testing) |
| verification-loop | Проверки после изменений | [affaan-m/ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/verification-loop) |
| 3d-website-architect | Визуальный дизайн, 3D и анимации веб-интерфейса | [deveshpunjabi/3d-website-skill](https://github.com/deveshpunjabi/3d-website-skill/tree/98f4cd4bfdf4cbb87c0f40d59d681158c490e9a5/skills/3d-website-architect) |


| click-path-audit | Проверка полного результата действий и переходов состояния | [ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/click-path-audit) |
| frontend-a11y | Формы, контраст, клавиатура и доступность | [ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/frontend-a11y) |
| frontend-design-direction | Визуальная иерархия и проверка отрисованного интерфейса | [ECC](https://github.com/affaan-m/ECC/tree/d2ef2680594f9a17526a6e1a2e18b3d242c5d17b/skills/frontend-design-direction) |

Файлы навыков скопированы без изменений вместе с лицензиями, скриптами и примерами.
Установка навыков не устанавливает Python Playwright и браузеры: они нужны при запуске браузерных проверок.
Команды сборки, проверки типов, линтера и тестов следует выбирать по фактическому стеку проекта; сейчас проект содержит отдельный HTML-файл.

`3d-website-architect` установлен вместе со справочниками и примерами оценочных запросов. Установка навыка не добавляет Three.js, React или другие зависимости на сайт; конкретный стек выбирается при выполнении задачи.

ECC — коллекция навыков. Здесь подключена подходящая проекту часть, а не глобальные хуки, агенты и настройки всего набора. В `frontend-design-direction` добавлен локальный `package.json` с `type: commonjs`, чтобы исходный проверяющий скрипт работал внутри ESM-проекта. Остальные исходные файлы скопированы без изменений.
