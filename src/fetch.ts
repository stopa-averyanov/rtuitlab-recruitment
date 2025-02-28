import ICAL from 'ical.js'
import { Target } from './target';
import { Lesson, lessonFromEvent } from './lesson.js';
import { createHash } from 'crypto'
import { config } from 'node-config-ts'

export interface SearchResult {

    targets : {

        name : string,
        targetType : number,
        remoteId : number
    }[]
    nextPageToken : string
}

export function parseLessons(jsonObject : string) : Lesson[] {

    const calendarComponent = _parseCalendarComponent(jsonObject);
    const lessons = _expandEvents(_extractEvents(calendarComponent)).map(event => lessonFromEvent(event));

    lessons.sort((a : Lesson, b : Lesson) => (a.start_date.valueOf() - b.start_date.valueOf()));

    return lessons;
}
export function generateMD5(jsonObject : string) : string {
    
    const checksumString = createHash('md5').update(jsonObject).digest('hex');
    return `${checksumString.substring(0, 8)}-${checksumString.substring(8, 12)}-${checksumString.substring(12, 16)}-${checksumString.substring(16, 20)}-${checksumString.substring(20, 32)}`
}

export async function fetchCalendarJSON(target : Target) : Promise<string | undefined> {
    
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

function _parseCalendarComponent(jsonObject : string) : ICAL.Component {

    const calendarComponent = ICAL.Component.fromString(jsonObject);
    
    // Weird timezone patch. Am I missing something? 
    const timezone = new ICAL.Timezone(calendarComponent.getFirstSubcomponent('vtimezone'));
    const standard = timezone.component.getFirstSubcomponent('standard');
    if (standard) standard.addPropertyWithValue('dtstart', '1970-01-01T00:00:00Z'); 
    // dtstart is not in timezone:standard in mirea's responses
    // https://www.kanzaki.com/docs/ical/vtimezone.html

    return calendarComponent;
}

function _extractEvents(component : ICAL.Component) : ICAL.Event[] {

    const subcomponents = component.getAllSubcomponents('vevent');

    return subcomponents
        .map(component => new ICAL.Event(component))
        .filter(event => event.location !== null);
}

function _expandEvents(events : ICAL.Event[]) : ICAL.Event[] {

    const eventsExpanded = new Array<ICAL.Event>;

    events.forEach(event => {

        eventsExpanded.push(..._expandEvent(event));
    });

    return eventsExpanded;
}

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