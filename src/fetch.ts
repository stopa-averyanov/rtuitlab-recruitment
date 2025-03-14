import ICAL from 'ical.js'
import { Target } from './target';
import { Lesson, lessonFromEvent } from './lesson.js';
import { createHash } from 'crypto'
import { config } from 'node-config-ts'

/**
 * Объект, содержащий результаты поиска через удаленный API
 */
export interface SearchResult {

    /**
     * Найденные на удаленном API сущности
     */
    readonly targets : {

        /** Имя сущности */
        readonly name : string,
        /** Тип сущности */
        readonly targetType : number,
        /** Айди сущности на удаленном API */
        readonly remoteId : number
    }[]
    /**
     * Токен следующей страницы для повторных запросов
     */
    readonly nextPageToken? : string
}

/**
 * Извлекает занятия из ICAL-календаря в текстовом виде
 * 
 * @param icalText ICAL-календарь с расписанием, занятия из которого необходимо извлечь
 * @returns Извлеченные занятия
 */
export function parseLessons(icalText : string) : Lesson[] {

    const calendarComponent = _parseCalendarComponent(icalText);
    const lessons = _expandEvents(_extractEvents(calendarComponent)).map(event => lessonFromEvent(event));

    lessons.sort((a : Lesson, b : Lesson) => (a.start_date.valueOf() - b.start_date.valueOf()));

    return lessons;
}

/**
 * Генерирует MD5 чек-сумму (в формате UUID) строки
 * 
 * @param text Строка, из которой необходимо сгенерировать чек-сумму
 * @returns Чек-сумма в формате UUID
 */
export function generateMD5(text : string) : string {
    
    const checksumString = createHash('md5').update(text).digest('hex');
    return `${checksumString.substring(0, 8)}-${checksumString.substring(8, 12)}-${checksumString.substring(12, 16)}-${checksumString.substring(16, 20)}-${checksumString.substring(20, 32)}`
}

/**
 * Запрашивает у удаленного API расписание для конкретной сущности
 * 
 * @param target Сущность, расписание для которой нужно получить
 * @returns ICAL-компонент в текстовом виде если найден на удаленном API, `undefined` иначе
 */
export async function fetchCalendarICALText(target : Target) : Promise<string | undefined> {
    
    const url = config.fetch.scheduleUrl.replace('{0}', String(target.target_type)).replace('{1}', String(target.remote_id));
    const response = await fetch(url, {
        headers: {
            "Accept": "text/calendar"
        }
    });
    if (response.ok) {
        return await response.text();
    }
    else return;
}

/**
 * Читает ICAL-компонент из текстового вида
 * 
 * @param icalText ICAL-компонент в текстовом виде
 * @returns ICAL-компонент в виде объекта `ICAL.Component`
 */
function _parseCalendarComponent(icalText : string) : ICAL.Component {

    const calendarComponent = ICAL.Component.fromString(icalText);
    
    // Weird timezone patch. Am I missing something? 
    const timezone = new ICAL.Timezone(calendarComponent.getFirstSubcomponent('vtimezone'));
    const standard = timezone.component.getFirstSubcomponent('standard');
    if (standard) standard.addPropertyWithValue('dtstart', '1970-01-01T00:00:00Z'); 
    // dtstart is not in timezone:standard in mirea's responses
    // https://www.kanzaki.com/docs/ical/vtimezone.html

    return calendarComponent;
}

/**
 * Извлекает события, имеющие локацию, из ICAL-календаря
 * 
 * @param component ICAL-Компонент, из которого нужно извлечь события
 * @returns 
 */
function _extractEvents(component : ICAL.Component) : ICAL.Event[] {

    const subcomponents = component.getAllSubcomponents('vevent');

    return subcomponents
        .map(component => new ICAL.Event(component))
        .filter(event => event.location !== null);
}

/**
 * Применяет к списку событий их правила `RRULE`, генерируя список развернутых повторяющихся событий
 * 
 * @param events События, которые нужно развернуть
 * @returns Список развернутых событий
 */
function _expandEvents(events : ICAL.Event[]) : ICAL.Event[] {

    const eventsExpanded = new Array<ICAL.Event>;

    events.forEach(event => {

        eventsExpanded.push(..._expandEvent(event));
    });

    return eventsExpanded;
}

/**
 * Применяет к событию его правило `RRULE`, генерируя список развернутых повторяющихся событий
 * 
 * @param event Событие, которое нужно развернуть
 * @returns Список развернутых событий
 */
function _expandEvent(event : ICAL.Event) : ICAL.Event[] {

    const iterator = event.iterator();
    const eventsExpanded = new Array<ICAL.Event>;

    while (!iterator.complete) {
        
        const expandedTime = iterator.next();

        if (expandedTime) {

            const eventExpanded = new ICAL.Event(
                new ICAL.Component(
                    ICAL.helpers.clone(event.component.jCal, true)
                )
            );
            eventExpanded.component.removeAllProperties('dtstart');
            eventExpanded.component.addPropertyWithValue('dtstart', expandedTime);
            eventsExpanded.push(eventExpanded);
        }
    }

    return eventsExpanded;
}

/**
 * Запрашивает у удаленного API поиск по включению строки
 * 
 * @param limit Ограничение по количеству результатов поиска
 * @param match Строка, поиск по включению которой нужно выполнить
 * @param pageToken Токен следующей страницы (при повторных запросах)
 * @returns Результаты поиска
 */
export async function fetchTargets(limit? : number, match? : string, pageToken? : string) : Promise<SearchResult | undefined> {

    const url = config.fetch.searchUrl + '?' + (limit ? `limit=${limit}` : '') + (match ? `match=${match}` : '') + (pageToken ? `&pageToken=${pageToken}` : '');

    const response = await fetch(url);
    
    if (response.ok) {

        const parsedObject = JSON.parse(await response.text());
        const targets = parsedObject.data;

        return {

            targets : targets.map((target : any) => {
                return {

                    name : target.fullTitle,
                    targetType : target.scheduleTarget,
                    remoteId : target.id
                }
            }),
            nextPageToken : parsedObject.nextPageToken
        }
    }
    else return undefined;
}