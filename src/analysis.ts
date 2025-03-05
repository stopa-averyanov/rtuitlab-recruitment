import { DistantClassroom, LargeGap, UnbalancedWeek, Bottlenecks } from "./bottleneck.js";
import { Lesson } from "./lesson.js";
import { config } from "node-config-ts";

/**
 * Анализирует набор занятий и возвращает найденные боттлнеки
 * 
 * @param lessons Занятия, которые необходимо проанализировать
 * @returns Найденные боттлнеки
 */
export function bottlenecksFromLessons(lessons : Lesson[]) : Bottlenecks {

    return {
        distantClassrooms : distantClassroomFromLessons(lessons),
        largeGaps : largeGapFromLessons(lessons),
        unbalancedWeeks : unbalancedWeekFromLessons(lessons),
    }
}

/**
 * Анализирует набор занятий на предмет далеких друг от друга аудиторий и возвращает найденные боттлнеки
 * 
 * @param lessons Занятия, которые необходимо проанализировать
 * @returns Найденные боттлнеки
 */
export function distantClassroomFromLessons(lessons : Lesson[]) : DistantClassroom[] {

    return _lessonPairBottleneck(lessons, _classroomsDistance);
}

/**
 * Анализирует набор занятий на предмет больших "окон" и возвращает найденные боттлнеки
 * 
 * @param lessons Занятия, которые необходимо проанализировать
 * @returns Найденные боттлнеки
 */
export function largeGapFromLessons(lessons : Lesson[]) : LargeGap[] {
    
    return _lessonPairBottleneck(lessons, _lessonGap);
}

/**
 * Анализирует набор занятий на предмет несбалансированных недель и возвращает найденные боттлнеки
 * 
 * @param lessons Занятия, которые необходимо проанализировать
 * @returns Найденные боттлнеки
 */
export function unbalancedWeekFromLessons(lessons : Lesson[]) : UnbalancedWeek[] {

    const maxRange = config.analysis.maxRangeOfLessonsPerDay;

    const bottlenecks : UnbalancedWeek[] = [];

    const weeks = _arrangeLessonsIntoWeeks(lessons);

    for (const week of weeks) {

        const balance = _weekBalance(week);

        const minLessons = Math.min(...balance.filter(x => x != 0));
        const maxLessons = Math.max(...balance.filter(x => x != 0));


        if (maxLessons - minLessons > maxRange) {

            if (week.some(lesson => lesson.target === undefined)) throw Error('All lessons in a week must have defined targets to construct a bottleneck');
            if (week.some(lesson => lesson.target !== week[0].target)) throw Error('All lessons in a week must share the same target to construct a bottleneck');
            if (week[0].target === undefined) return [];

            bottlenecks.push({
                target : week[0].target,
                start_date : _getWeekStart(week[0].start_date),
                lessons : balance
            })
        }
    }

    return bottlenecks;
}

/**
 * Проверяет, находятся ли два занятия в паре достаточно далеко друг от друга относительно перерыва между ними
 * 
 * @param lessonA Первое занятие в паре
 * @param lessonB Второе занятие в паре
 * @returns `true` если занятия расположены слишком далеко, `false` иначе
 */
function _classroomsDistance(lessonA : Lesson, lessonB : Lesson) : boolean {

    const ignoreOnlineClasses = config.analysis.ignoreOnlineClasses;
    const ignoreGymClasses = config.analysis.ignoreGymClasses;
    const ignoreDifferentBuildings = config.analysis.ignoreDifferentBuildings;

    const buildingRegex = /[^-\s]+/;
    const campusRegex = /(?<= )\(.+\)/;

    if (ignoreOnlineClasses)
        if (lessonA.location.includes("Дистанционно (СДО)") || lessonB.location.includes("Дистанционно (СДО)")) return false;
    
    if (ignoreGymClasses)
        if (lessonA.summary.includes("Физическая культура и спорт") || lessonB.summary.includes("Физическая культура и спорт")) return false;

    const buildingA = (buildingRegex.exec(lessonA.location) ?? [""])[0];
    const buildingB = (buildingRegex.exec(lessonB.location) ?? [""])[0];
    
    const campusA = (campusRegex.exec(lessonA.location) ?? [""])[0];
    const campusB = (campusRegex.exec(lessonB.location) ?? [""])[0];

    if (campusA == '(С-20)' && campusB == '(С-20)') return false;

    const hourMS = 60 * 60 * 1000;
    const lessonDurationMS = hourMS * 1.5;
    const breakDurationMS = lessonB.start_date.valueOf() - lessonA.start_date.valueOf() - lessonDurationMS;

    if (breakDurationMS <= hourMS * 1.5 && campusA !== campusB) return true;

    if (!ignoreDifferentBuildings) return false;
    
    return (breakDurationMS <= hourMS / 6 && buildingA !== buildingB);
}

/**
 * Проверяет, не слишком ли большое "окно" между двумя занятиями в паре
 * 
 * @param lessonA Первое занятие в паре
 * @param lessonB Второе занятие в паре
 * @returns `true` если между занятиями слишком большое окно, `false` иначе
 */
function _lessonGap(lessonA : Lesson, lessonB : Lesson) : boolean {

    const ignoreOnlineClasses = config.analysis.ignoreOnlineClasses;
    const maxGapLengthHrs = config.analysis.maxGapLengthHrs;

    if (ignoreOnlineClasses)
        if (lessonA.location.includes("Дистанционно (СДО)") || lessonB.location.includes("Дистанционно (СДО)")) return false;

    const hourMS = 60 * 60 * 1000;
    const lessonDurationMS = hourMS * 1.5;
    const breakDurationMS = lessonB.start_date.valueOf() - lessonA.start_date.valueOf() - lessonDurationMS;

    if (lessonA.start_date.getUTCDate() !== lessonB.start_date.getUTCDate()) return false;

    return breakDurationMS >= hourMS * maxGapLengthHrs;
}

/**
 * Считает количество занятий в день в течение недели, считая занятия, *проходящие в одно и то же время*, как одно
 * 
 * @param lessons Занятия, которые нужно посчитать
 * @returns Список количества занятий в день по дням недели начиная с понедельника
 */
function _weekBalance(lessons : Lesson[]) : number[] {

    const weekGrouped = _collapseToGroups(lessons);

    const lessonsPerDay = [0, 0, 0, 0, 0, 0];

    weekGrouped.forEach(lessonGroup => {

        const lesson = lessonGroup[0];

        if (lesson.start_date.getUTCDay() != 0) 
            lessonsPerDay[lesson.start_date.getUTCDay() - 1] += 1; 
    });

    return lessonsPerDay;
}

/**
 * Сортирует и анализирует набор занятий попарно с помощью предоставленной функции
 * 
 * @param lessons Занятия, которые нужно проанализировать
 * @param callback Функция, анализирующая пару занятий
 * @returns Список найденных боттлнеков 
 */
function _lessonPairBottleneck(lessons : Lesson[], callback : (a : Lesson, b : Lesson) => boolean) : DistantClassroom[] | LargeGap[] {

    const pairs = _arrangeLessonsIntoPairs(lessons).filter(pair => callback(pair[0], pair[1]));;

    const bottlenecks : DistantClassroom[] | LargeGap[] = pairs.map(pair => {

        const lessonA = pair[0];
        const lessonB = pair[1];

        if (lessonA.target === undefined) throw Error('Both lessons must have a defined target to construct a bottleneck');
        if (lessonB.target === undefined) throw Error('Both lessons must have a defined target to construct a bottleneck');
        if (lessonA.target !== lessonB.target) throw Error('Both lessons must have the same target');
        if (lessonA.pk === undefined) throw Error('A lesson must have a defined primary key to construct a bottleneck');
        if (lessonB.pk === undefined) throw Error('A lesson must have a defined primary key to construct a bottleneck');

        return {

            target : lessonA.target,
            lesson_a : lessonA.pk,
            lesson_b : lessonB.pk,
            start_date : lessonA.start_date
        }
    });

    return bottlenecks;
}

/**
 * Преобразует список неупорядоченных занятий в список пар занятий, идущих друг за другом
 * 
 * В случае, когда в одно время проходят несколько занятий, генерирует по паре для каждого из нескольких
 * 
 * @param lessons Занятия, которые нужно преобразовать в пары
 * @returns Список пар занятий
 */
function _arrangeLessonsIntoPairs(lessons : Lesson[]) : Lesson[][] {
    
    const lessonGroups = _collapseToGroups(lessons);
    const lessonPairs : Lesson[][] = [];

    for (let i = 0; i < lessonGroups.length - 1; i++) {
    
        lessonGroups[i].forEach(
            a => lessonGroups[i + 1].forEach(
                b => lessonPairs.push([a, b])
            )
        );
    }

    return lessonPairs;
}

/**
 * Преобразует неупорядоченный список занятий в упорядоченный список групп занятий, идущих в одно и то же время
 * 
 * В группе одно занятие, если оно является единственным, которое проходит в свое время, или несколько, если они проходят одновременно
 * 
 * @param lessons Занятия, которые нужно преобразовать в группы
 * @returns Группы занятий, в каждой из которых одно или больше занятий
 */
function _collapseToGroups(lessons : Lesson[]) : Lesson[][] {

    function _compareDates(lessonA : Lesson, lessonB : Lesson) : boolean {

        return lessonA.start_date.getTime() === lessonB.start_date.getTime();
    }

    const lessonGroups = lessons.toSorted().map(lesson => [lesson]);

    for (let i = 0; i < lessonGroups.length; i++) {
    
        while (i < lessonGroups.length - 1 && _compareDates(lessonGroups[i][0], lessonGroups[i + 1][0])) {
    
            lessonGroups[i].push(...lessonGroups[i + 1]);
            lessonGroups.splice(i + 1, 1);
        }
    }
    return lessonGroups;
}

/**
 * Преобразует неупорядоченный список занятий в список недель — то есть, список списков занятий, сгруппированных по неделям
 * 
 * @param lessons Занятия, которые нужно преобразовать в список недель
 * @returns Список недель, содержащий занятия
 */
function _arrangeLessonsIntoWeeks(lessons : Lesson[]) : Lesson[][] {
    
    const weeks = lessons.toSorted().map(lesson => [lesson]);

    for (let i = 0; i < weeks.length; i++) {
    
        while (i < weeks.length - 1 && _compareWeeks(weeks[i][0], weeks[i + 1][0])) {
    
            weeks[i].push(...weeks[i + 1]);
            weeks.splice(i + 1, 1);
        }
    }
    return weeks;
}

/**
 * Сравнивает недели двух занятий
 * 
 * @param lessonA Первое занятие
 * @param lessonB Второе занятие
 * @returns `true` если проходят в течение одной и той же недели, `false` иначе
 */
function _compareWeeks(lessonA : Lesson, lessonB : Lesson) : boolean {
    
    const sundayA = _getWeekStart(lessonA.start_date);
    const sundayB = _getWeekStart(lessonB.start_date);

    return sundayA.getTime() === sundayB.getTime();
}

/**
 * Находит неделю, к которой принадлежит произвольный день
 * 
 * @param date День, неделю которого нужно найти
 * @returns Дата полуночи воскресенья по UTC, с которого начинается неделя дня
 */
function _getWeekStart(date : Date) : Date {

    const sunday = new Date(date.getTime());
    sunday.setUTCDate(date.getUTCDate() - date.getUTCDay());
    sunday.setUTCHours(0,0,0,0);
    return sunday;
}