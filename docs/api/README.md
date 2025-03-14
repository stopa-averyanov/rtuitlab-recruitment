# Справка по использованию REST API

Данный раздел подразумевает, что пользователь знаком с использованием REST API в целом и общими понятиями и не останавливается на них отдельно.

## Перед началом работы

Так как вебсервис тесно взаимодействует с API РТУ МИРЭА https://schedule-of.mirea.ru/schedule/api/, группы и преподаватели при работе с сервисом идентифицируются по номеру, соответствующему их номеру в API РТУ МИРЭА (далее — удаленный API). Таким образом, анализ расписания группы с идентификатором 4789 будет включать себя получение расписания по адресу https://schedule-of.mirea.ru/schedule/api/ical/1/4789.

Сервис способен анализировать индивидуальные расписания конкретных групп/преподавателей и выполнять поиск и анализ расписаний по включению. И то, и другое происходит посредством создания задач на сервере и отложенного получения их результата. После отправки запроса, клиент получает номер задачи, с которым впоследствии обращается к сервису для получения статуса задачи, и когда выполнение задачи завершается, клиент получает результат выполнения по номеру задачи. 

Всвязи с этим, все конечные точки подкаталога `/jobs/submit/` возвращают объект, содержащий поле `jobId` с номером задачи.

Пример ответа сервера на [`POST /jobs/submit/search/`](./submit/search.md)

```
{
    "jobId" : 1
}
```

Получение статусов при этом происходит через [`GET /jobs/status/`](./status.md), возвращающий объект с полем `status`, содержащим статус задачи.

Пример ответа сервера на [`GET /jobs/status/`](./status.md)

```
{
    "status": "processing"
}
```

Существующие статусы включают в себя:

- `"not found"` — Задача не найдена на сервере (еще не создана или уже выполнена)
- `"processing"` — Сервер обрабатывает задачу
- `"done"` — Сервер успешно выполнил задачу и готов предоставить результат выполнения
- `"error"` — Во время обработки задачи произошла ошибка

При этом важно, что отправка статуса `"error"` рассматривается сервером как завершение задачи, поскольку клиент осведомлен, что задача не имеет результата, который можно было бы получить. 

Получение результата при статусе `"done"` происходит через [`GET /jobs/result/`](result.md). Тип возвращаемого объекта при этом зависит от изначально отправленного клиентом запроса.

Существует ситуация, когда клиент получает один и тот же номер задачи от сервера дважды: это происходит тогда, когда клиент отправляет два идентичных запроса на сервер и они еще не закончили обрабатываться.

## Доступные конечные точки

* Отправка запроса на анализ расписания группы : [`POST /jobs/submit/analysis/group/:groupId/`](./submit/analysis/group.md)
* Отправка запроса на анализ расписания преподавателя : [`POST /jobs/submit/analysis/prof/:profId/`](./submit/analysis/prof.md)
* Отправка запроса на поиск и анализ : [`POST /jobs/submit/search/`](./submit/search.md)
* Получение статуса задачи : [`GET /jobs/status/:jobId/`](./status.md)
* Получение результата выполнения задачи : [`GET /jobs/result/:jobId/`](./result.md)