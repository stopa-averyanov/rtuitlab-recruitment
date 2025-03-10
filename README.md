# REST API для анализа расписаний РТУ МИРЭА

Веб-сервис, выполняющий поиск и анализ расписаний преподавателей и студенческих групп на предмет "неудобных" мест.

## Начало работы

### Docker

* Скачайте последний [docker-compose файл](./compose.yaml).
* Задайте переменную `$PORT` для порта, который веб-сервис будет слушать:
```
set PORT=8080
```
* Запустите веб-сервис:
```
docker compose up
```
* Проверьте веб-сервис на отклик:
```
curl http://localhost:8080/jobs/status/1/
```

Во время работы в папке "pgdata" сохраняются данные из базы данных.

### Развертка вручную

> Веб-сервис хранит результаты анализов расписаний в базе данных. Для работы веб-сервиса необходимо подключение к базе данных PostgreSQL 17 или старше.

* Разверните базу данных, создав таблицы согласно [init.sql](./init.sql).
* Настройте доступ к базе данных, заполнив [default.json](./config/default.json) соответствующе.
```jsonc
{
    "db" : {

        "host": "127.0.0.1", // Адрес
        "port": 5432, // Порт
        "password": "password", // Пароль
        "user": "rtuitlab-webapp", // Имя пользователя
        "database": "rtuitlab-webapp-db" // Имя базы данных
    }
}
```
* Установите зависимости:
```
npm install
```
* Запустите веб-сервис:
```
npm run start
```
* Проверьте веб-сервис на отклик:
```sh
curl http://localhost:8080/jobs/status/1/
```

Веб-сервис ответит `{ "status" : "not found" }`.

### Настройка веб-сервиса

Тонкая настройка поведения веб-сервиса при развертке вручную возможна с использованием файла конфигурации [default.json](./config/default.json). Подробное описание файла содержится в [config/README.md](./config/README.md).

Помимо настройки поведения веб-сервиса через файл конфигурации, при развертке вручную веб-сервис принимает настройки через параметры запуска.

Например, задать веб-сервису новый порт для прослушки можно запустив его таким образом:
```sh
npm run start -- --app.port=8081
```

## Использование

Реализуя REST API, сервис принимает запросы на анализ расписаний индивидуальных групп и преподавателей и поиск и анализ расписаний по включению строки в имя группы или преподавателя. 

Сервис не отвечает на запросы результатом сразу; вместо этого сервис создает задачу и возвращает ее уникальный номер, по которому впоследствии клиент может получить результат запрошенного анализа/поиска.

Например, для анализа расписания группы ИКБО-21-24, которой на момент написания на удаленном API соответствует идентификатор 4789, нужно сделать следующий запрос к сервису:

```
curl -X POST http://localhost:8080/jobs/submit/analysis/group/4789/
```

Сервис при этом ответит JSON-объектом, содержащим номер созданной задачи. Например, `{ "jobId" : 1 }`.

После этого к сервису стоит обратиться для получения статуса задачи:

```
curl -X GET http://localhost:8080/jobs/status/1/
```

Если все хорошо и задача была успешно выполнена, сервис ответит `{ "status" : "done" }`. Можно обращаться к сервису за результатом задачи:

```
curl -X GET http://localhost:8080/jobs/result/1/
```

Ответ содержит результаты анализа в JSON-формате, а именно:
* список занятий, проходящих слишком далеко друг от друга с недостаточно большими перерывами между ними;
* список занятий с, наоборот, слишком большими "окнами" между ними;
* список "несбалансированных" недель — то есть, недель, в которых слишком мало занятий в один день, но слишком много в другой.

Подробное описание конечных точек API и структуры ответов содержится в [docs/api/](./docs/api/README.md).