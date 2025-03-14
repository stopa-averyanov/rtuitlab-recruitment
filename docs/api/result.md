# Получение результата выполнения задачи

Используется для получения результатов анализа расписания/поиска и анализа расписаний. Структура ответа будет зависеть от вида запроса при создании соответствующей задачи.

## Запрос

### URL : `GET /jobs/result/:jobId`

### `jobId` : целое число 

Номер задачи

## Ответ (При выполнении анализа)

### `distantClassrooms[]` : список

Список пар занятий, расположенных слишком далеко друг от друга.

### `distantClassrooms[].lesson_a` : объект

Первое занятие, от которого придется бежать ко второму

### `distantClassrooms[].lesson_a.location` : строка

Аудитория первого занятия (вместе с корпусом и кампусом)

### `distantClassrooms[].lesson_a.summary` : строка

Наименование первого занятия (Например, "ПР Иностранный язык")

### `distantClassrooms[].lesson_a.start_date` : строка

Дата и время проведения первого занятия в формате ISO 8601

### `distantClassrooms[].lesson_b` : объект

Второе занятие, к которому придется бежать от первого

### `distantClassrooms[].lesson_b.location` : строка

Аудитория второго занятия (вместе с корпусом и кампусом)

### `distantClassrooms[].lesson_b.summary` : строка

Наименование второго занятия (Например, "ПР Иностранный язык")

### `distantClassrooms[].lesson_b.start_date` : строка

Дата и время проведения второго занятия в формате ISO 8601

---

### `largeGaps[]` : список

Список пар занятий, которые содержат "окна", продолжительность которых превышает одно занятие (с перерывами)

### `largeGaps[].lesson_a` : объект

Занятие, после которого следует "окно"

### `largeGaps[].lesson_a.location` : строка

Аудитория первого занятия (вместе с корпусом и кампусом)

### `largeGaps[].lesson_a.summary` : строка

Наименование первого занятия (Например, "ПР Иностранный язык")

### `largeGaps[].lesson_a.start_date` : строка

Дата и время проведения первого занятия в формате ISO 8601

### `largeGaps[].lesson_b` : объект

Занятие, которое начинается после "окна"

### `largeGaps[].lesson_b.location` : строка

Аудитория второго занятия (вместе с корпусом и кампусом)

### `largeGaps[].lesson_b.summary` : строка

Наименование второго занятия (Например, "ПР Иностранный язык")

### `largeGaps[].lesson_b.start_date` : строка

Дата и время проведения второго занятия в формате ISO 8601

---

### `unbalancedWeeks[]` : список

Список недель, содержащих слишком большие разницы в количествах занятий в день (например, 2 занятия в один день, но 5 занятий в другой)

### `unbalancedWeeks[].start_date` : строка

Дата несбалансированной недели в формате ISO 8601 начиная с воскресенья

### `unbalancedWeeks[].lessons[]` : список целых чисел

Список с количествами занятий в день (Каждое число соответствует дню недели c понедельника по субботу)

### Пример ответа

```jsonc
{
    "distantClassrooms": [
        {
            "lesson_a": {
                "location": "ИВЦ-110 (В-78)",
                "summary": "ПР Системы искусственного интеллекта и большие данные",
                "start_date": "2025-02-10T09:40:00.000Z"
            },
            "lesson_b": {
                "location": "А-323 (В-78)",
                "summary": "ПР Русский язык и культура речи",
                "start_date": "2025-02-10T11:20:00.000Z"
            },
            "start_date": "2025-02-10T09:40:00.000Z"
        }
        // ...
    ],
    "largeGaps": [
        {
            "lesson_a": {
                "location": "И-208 (В-78)",
                "summary": "ПР Системы искусственного интеллекта и большие данные",
                "start_date": "2025-05-23T07:40:00.000Z"
            },
            "lesson_b": {
                "location": "И-201 (В-78)",
                "summary": "ПР Системы искусственного интеллекта и большие данные",
                "start_date": "2025-05-23T13:20:00.000Z"
            },
            "start_date":"2025-05-23T07:40:00.000Z"
        }
        // ...
    ],
    "unbalancedWeeks": [
        {
            "start_date": "2025-02-16T00:00:00.000Z",
            "lessons": [
                4,
                5,
                2,
                5,
                5,
                0
            ]
        }
        // ...
    ]
}
```

## Ответ (При выполнении поиска и анализа)

### `targets[]` : список

Список найденных сущностей, имеющих свое расписание (групп, преподавателей, аудиторий — анализ расписаний для аудиторий не производится)

### `targets[].name` : строка

Имя найденной сущности

### `targets[].targetType` : целое число

Тип найденной сущности, где `1` — группа студентов, `2` — преподаватель, `3` — аудитория. Типы соответствуют типам в удаленном API

### `targets[].remoteId` : целое число

Айди найденной сущности в удаленном API

### `targets[].bottlenecks` : объект

Результат анализа расписания найденной сущности, доступного на удаленном API. Структура объекта соответствует результату анализа расписания через [`POST /jobs/submit/analysis/group/`](./submit/analysis/group.md) и [`POST /jobs/submit/analysis/prof/`](./submit/analysis/prof.md)

### `nextPageToken?` : строка (опционально)

Токен следующей страницы поиска

### Пример ответа

```jsonc
{
    "targets": [
        {
            "name": "ИКБО-07-21",
            "targetType": 1,
            "remoteId": 287,
            "bottlenecks": {
                "distantClassrooms": [
                    // ...
                ],
                "largeGaps": [
                    // ...
                ],
                "unbalancedWeeks": [
                    // ...
                ]
            }
        },
        {
            "name": "ИКБО-10-24",
            "targetType": 1,
            "remoteId": 4781,
            "bottlenecks": {
                // ...
            }
        }
        // ...
    ],
    "nextPageToken": "CAoSDtCY0JrQkdCeLTE5LTIyGIcEIgzQmNCa0JHQnjE5MjI="
}
```

## Возможные коды статуса

### `200` : OK

### `400` : Предоставленный jobId не является целым числом

### `503` : Сервер не может предоставить результат задачи, так как задача находится в работе

### `404` : Задача с предоставленным jobId не найдена на сервере (еще не создана или уже завершена)

### `500` : Во время обработки задачи произошла внутренняя ошибка