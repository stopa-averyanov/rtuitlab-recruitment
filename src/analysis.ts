import { DistantClassroom, LargeGap, UnbalancedWeek, Bottlenecks } from "./bottleneck.js";
import { Lesson } from "./lesson.js";
import { config } from "node-config-ts";

export function bottlenecksFromLessons(lessons : Lesson[]) : Bottlenecks {

    return {
        distantClassrooms : distantClassroomFromLessons(lessons),
        largeGaps : largeGapFromLessons(lessons),
        unbalancedWeeks : unbalancedWeekFromLessons(lessons),
    }
}

export function distantClassroomFromLessons(lessons : Lesson[]) : DistantClassroom[] {

    return _lessonPairBottleneck(lessons, _classroomsDistance);
}

export function largeGapFromLessons(lessons : Lesson[]) : LargeGap[] {
    
    return _lessonPairBottleneck(lessons, _lessonGap);
}

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

function _compareWeeks(lessonA : Lesson, lessonB : Lesson) : boolean {
    
    const sundayA = _getWeekStart(lessonA.start_date);
    const sundayB = _getWeekStart(lessonB.start_date);

    return sundayA.getTime() === sundayB.getTime();
}

function _getWeekStart(date : Date) : Date {

    const sunday = new Date(date.getTime());
    sunday.setUTCDate(date.getUTCDate() - date.getUTCDay());
    sunday.setUTCHours(0,0,0,0);
    return sunday;
}