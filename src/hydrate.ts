import { Pool } from "pg";
import { Bottlenecks, DistantClassroom, LargeGap, UnbalancedWeek } from "./bottleneck.js";
import { Lesson, lessonFind } from "./lesson.js";
import { targetFind } from "./target.js";
import { SearchResult } from "./fetch.js";
import { processAnalysis } from "./process.js";

/**
 * "Наполненный" {@link SearchResult}; объект, содержащий результаты поиска через удаленный API вместе с результатами анализа
 */
export interface SearchResultHydrated {

    readonly targets : {

        readonly name : string,
        readonly targetType : number,
        readonly remoteId : number,
        readonly bottlenecks : BottlenecksHydrated
    }[]
    readonly nextPageToken : string
}

/**
 * "Наполненный" {@link DistantClassroom}; объект боттлнека, случающегося при необходимости бежать от занятия к занятию
 * 
 * В отличие от {@link DistantClassroom}, содержит подробную информацию о занятиях и не привязан к базе данных
 */
export interface DistantClassroomHydrated {

    readonly lesson_a : Lesson;
    readonly lesson_b : Lesson;
    readonly start_date : Date;
}

/**
 * "Наполненный" {@link LargeGap}; объект боттлнека, случающегося при больших "окнах" между занятиями
 * 
 * В отличие от {@link LargeGap}, содержит подробную информацию о занятиях и не привязан к базе данных
 */
export interface LargeGapHydrated {
    
    readonly lesson_a : Lesson;
    readonly lesson_b : Lesson;
    readonly start_date : Date;
}

/**
 * "Наполненный" {@link UnbalancedWeek}; объект боттлнека, случающегося при несбалансированных неделях
 * 
 * В отличие от {@link UnbalancedWeek}, не привязан к базе данных
 */
export interface UnbalancedWeekHydrated {

    readonly start_date : Date;
    readonly lessons : number[];
}

/**
 * "Наполненный" {@link Bottlenecks}; объект, группирующий вместе боттлнеки
 * 
 * В отличие от {@link Bottlenecks}, содержит подробную информацию о боттлнеках и занятиях
 */
export interface BottlenecksHydrated {

    readonly distantClassrooms : DistantClassroomHydrated[],
    readonly largeGaps : LargeGapHydrated[],
    readonly unbalancedWeeks : UnbalancedWeekHydrated[]
}

/**
 * Анализирует расписания сущностей в объекте результатов поиска и "наполняет" результаты информацией о боттлнеках
 * 
 * @param searchResult "Высушенные" результаты поиска, которые надо "наполнить"
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns "Наполненные" результаты поиска, содержащие информацию о боттлнеках
 */
export async function hydrateSearchResult(searchResult : SearchResult, pool : Pool) : Promise<SearchResultHydrated> {

    const searchResultHydrated : SearchResultHydrated = {

        targets : [],
        nextPageToken : searchResult.nextPageToken
    };

    await Promise.all(searchResult.targets.map(async target => {

        if (target.targetType !== 1 && target.targetType !== 2) {

            searchResultHydrated.targets.push({ ...target, bottlenecks : {
                distantClassrooms : [],
                largeGaps : [],
                unbalancedWeeks : []
            }});
            return;
        }
        const bottlenecks = await processAnalysis(target.targetType, target.remoteId, pool);

        if (bottlenecks === undefined) {
            searchResultHydrated.targets.push({ ...target, bottlenecks : {
                distantClassrooms : [],
                largeGaps : [],
                unbalancedWeeks : []
            }});
            return;
        }
        searchResultHydrated.targets.push({ ...target, bottlenecks : bottlenecks});
    }));

    return searchResultHydrated;
}
// TODO : extract analysis logic somehow? maybe add an analysis callback argument?

/**
 * "Наполняет" группу боттлнеков подробной информацией о занятиях, к которым они относятся
 * 
 * Должен вызываться как минимум с одним из аргументов `lessons` или `pool`
 * 
 * @param bottlenecks "Высушенная" группа боттлнеков, которую надо "наполнить"
 * @param lessons Список занятий, которые стоит использовать для наполнения
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns "Наполненная" группа боттлнеков, содержащая подробную информацию о занятиях
 */
export async function hydrateBottlenecks(bottlenecks : Bottlenecks, lessons? : Lesson[], pool? : Pool) : Promise<BottlenecksHydrated> {

    return {

        distantClassrooms : await hydrateDistantClassrooms(bottlenecks.distantClassrooms, lessons, pool),
        largeGaps : await hydrateLargeGaps(bottlenecks.largeGaps, lessons, pool),
        unbalancedWeeks : hydrateUnbalancedWeeks(bottlenecks.unbalancedWeeks)
    }
}

/**
 * "Наполняет" боттлнеки далеких друг от друга занятий подробной информацией о занятиях, к которым они относятся
 * 
 * Должен вызываться как минимум с одним из аргументов `lessons` или `pool`
 * 
 * @param bottlenecks Список "высушенных" боттлнеков, которые надо "наполнить"
 * @param lessons Список занятий, которые стоит использовать для наполнения
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Список "наполненных" боттлнеков, содержащих подробную информацию о занятиях
 */
export async function hydrateDistantClassrooms(bottlenecks : DistantClassroom[], lessons? : Lesson[], pool? : Pool) : Promise<DistantClassroomHydrated[]> {
    
    const bottlenecksHydrated : DistantClassroomHydrated[] = await Promise.all(bottlenecks.map(async (bottleneck) : Promise<DistantClassroomHydrated> => _hydrateDistantClassroom(bottleneck, lessons, pool)));

    return bottlenecksHydrated;
}

/**
 * "Наполняет" боттлнеки далеких друг от друга занятий подробной информацией о занятиях, к которым они относятся
 * 
 * Должен вызываться как минимум с одним из аргументов `lessons` или `pool`
 * 
 * @param bottlenecks Список "высушенных" боттлнеков, которые надо "наполнить"
 * @param lessons Список занятий, которые стоит использовать для наполнения
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Список "наполненных" боттлнеков, содержащих подробную информацию о занятиях
 */
export async function hydrateLargeGaps(bottlenecks : LargeGap[], lessons? : Lesson[], pool? : Pool) : Promise<LargeGapHydrated[]> {
    
    const bottlenecksHydrated : LargeGapHydrated[] = await Promise.all(bottlenecks.map(async (bottleneck) : Promise<LargeGapHydrated> => _hydrateDistantClassroom(bottleneck, lessons, pool)));

    return bottlenecksHydrated;
}

/**
 * Отвязывает список боттлнеков несбалансированных недель от базы данных
 * 
 * @param bottlenecks Список "высушенных" боттлнеков, которые надо отвязать от базы данных
 * @returns Отвязанные от базы данных боттлнеки
 */
export function hydrateUnbalancedWeeks(bottlenecks : UnbalancedWeek[]) : UnbalancedWeekHydrated[] {

    return bottlenecks.map(bottleneck => { 
        return {
            start_date : bottleneck.start_date,
            lessons : bottleneck.lessons
        }
    });
}

/**
 * "Наполняет" боттлнек далеких друг от друга занятий подробной информацией о занятиях, к которым он относятся
 * 
 * Должен вызываться как минимум с одним из аргументов `lessons` или `pool`
 * 
 * Может также быть вызван для боттлнеков больших "окон" между парами
 * 
 * @param bottlenecks "Высушенный" боттлнек, который надо "наполнить"
 * @param lessons Список занятий, которые стоит использовать для наполнения
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns "Наполненный" боттлнек, содержащий подробную информацию о занятиях
 */
async function _hydrateDistantClassroom(bottleneck : DistantClassroom, lessons? : Lesson[], pool? : Pool) {
    
    if (pool === undefined) {

        if (lessons === undefined) throw Error('Either a list of lessons or a database pool has to be supplied');

        return _hydrateDistantClassroomLocal(bottleneck, lessons);
    }
    try {

        const bottleneckHydrated = _hydrateDistantClassroomRemote(bottleneck, pool);
        return bottleneckHydrated;
    }
    catch (error) {

        if (lessons === undefined) throw error;

        const bottleneckHydrated = _hydrateDistantClassroomLocal(bottleneck, lessons);
        return bottleneckHydrated;
    }
}

/**
 * "Наполняет" боттлнек далеких друг от друга занятий подробной информацией о занятиях, к которым он относятся
 * 
 * Извлекает информацию о занятиях из предоставленного списка существующих занятий
 * 
 * Может также быть вызван для боттлнеков больших "окон" между парами
 * 
 * @param bottlenecks "Высушенный" боттлнек, который надо "наполнить"
 * @param lessons Список занятий, которые стоит использовать для наполнения
 * @returns "Наполненный" боттлнек, содержащий подробную информацию о занятиях
 */
function _hydrateDistantClassroomLocal(bottleneck : DistantClassroom, lessons : Lesson[]) : DistantClassroomHydrated {
    
    const lessonA = lessons.find(lesson => lesson.pk === bottleneck.lesson_a);
    const lessonB = lessons.find(lesson => lesson.pk === bottleneck.lesson_b);
    
    if (lessonA === undefined) throw Error('Bottleneck\'s lesson A missing in the supplied list');
    if (lessonB === undefined) throw Error('Bottleneck\'s lesson B missing in the supplied list');

    return {

        lesson_a : _lessonStrip(lessonA),
        lesson_b : _lessonStrip(lessonB),
        start_date : bottleneck.start_date
    }
}

/**
 * "Наполняет" боттлнек далеких друг от друга занятий подробной информацией о занятиях, к которым он относятся
 * 
 * Получает информацию о занятиях от базы данных
 * 
 * Может также быть вызван для боттлнеков больших "окон" между парами
 * 
 * @param bottleneck "Высушенный" боттлнек, который надо "наполнить"
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns "Наполненный" боттлнек, содержащий подробную информацию о занятиях
 */
async function _hydrateDistantClassroomRemote(bottleneck : DistantClassroom, pool : Pool) : Promise<DistantClassroomHydrated> {

    const target = await targetFind(bottleneck.target, pool);
    if (target === undefined) throw Error('Bottleneck\'s target missing in the database');

    const lessonA = await lessonFind(target, bottleneck.lesson_a, pool);
    const lessonB = await lessonFind(target, bottleneck.lesson_b, pool);

    if (lessonA === undefined) throw Error('Bottleneck\'s lesson A missing in the database');
    if (lessonB === undefined) throw Error('Bottleneck\'s lesson B missing in the database');

    return {

        lesson_a : _lessonStrip(lessonA),
        lesson_b : _lessonStrip(lessonB),
        start_date : bottleneck.start_date
    }
}

/**
 * Отвязывает занятие от базы данных, стирая информацию о сущности, к которой занятие принадлежит, и его первичный ключ
 * 
 * @param lesson Занятие, которое нужно очистить
 * @returns Очищенное занятие, существующее отдельно от своей сущности и базы данных
 */
function _lessonStrip(lesson : Lesson) : Lesson {

    return {
        location : lesson.location,
        summary : lesson.summary,
        start_date : lesson.start_date
    }
}