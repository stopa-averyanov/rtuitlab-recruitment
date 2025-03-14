# Отправка запроса на анализ расписания группы

Используется для создания на сервере задачи поиска расписаний групп и преподавателей и их анализа. Выполняется с опциональным параметром строки, поиск по включению которой будет происходить, а также опциональным параметром ограничения количества результатов и опциональным параметром токена следующей страницы (для последующих запросов)

Структура результата выполнения задачи описана в [`GET /jobs/result/`](../result.md)

## Запрос

### URL : `POST /jobs/submit/search/`

## Query-параметры запроса

### `match` : строка 

Параметр поиска; строка, по включению которой будет осуществляться поиск

### `limit` : целое число

Ограничение по количеству результатов на страницу

### `pageToken` : строка

Токен страницы (при повторных запросах)

## Ответ

### `jobId` : целое число

Номер созданной на сервере задачи, по которому будет происходить получение результатов анализа

## Возможные коды статуса

### `200` : OK