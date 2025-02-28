import { Pool } from "pg";
import { Bottlenecks, DistantClassroom, LargeGap, UnbalancedWeek } from "./bottleneck.js";
import { Lesson, lessonFind } from "./lesson.js";
import { targetFind } from "./target.js";
import { SearchResult } from "./fetch.js";
import { processAnalysis } from "./process.js";

export interface SearchResultHydrated {

    targets : {

        name : string,
        targetType : number,
        remoteId : number,
        bottlenecks : BottlenecksHydrated
    }[]
    nextPageToken : string
}

export interface DistantClassroomHydrated {

    readonly lesson_a : Lesson;
    readonly lesson_b : Lesson;
    readonly start_date : Date;
}

export interface LargeGapHydrated {
    
    readonly lesson_a : Lesson;
    readonly lesson_b : Lesson;
    readonly start_date : Date;
}

export interface UnbalancedWeekHydrated {

    readonly start_date : Date;
    readonly lessons : number[];
}

export interface BottlenecksHydrated {

    readonly distantClassrooms : DistantClassroomHydrated[],
    readonly largeGaps : LargeGapHydrated[],
    readonly unbalancedWeeks : UnbalancedWeekHydrated[]
}

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
export async function hydrateBottlenecks(bottlenecks : Bottlenecks, lessons? : Lesson[], pool? : Pool) : Promise<BottlenecksHydrated> {

    return {

        distantClassrooms : await hydrateDistantClassrooms(bottlenecks.distantClassrooms, lessons, pool),
        largeGaps : await hydrateLargeGaps(bottlenecks.largeGaps, lessons, pool),
        unbalancedWeeks : hydrateUnbalancedWeeks(bottlenecks.unbalancedWeeks)
    }
}
export async function hydrateDistantClassrooms(bottlenecks : DistantClassroom[], lessons? : Lesson[], pool? : Pool) : Promise<DistantClassroomHydrated[]> {
    
    const bottlenecksHydrated : DistantClassroomHydrated[] = await Promise.all(bottlenecks.map(async (bottleneck) : Promise<DistantClassroomHydrated> => _hydrateDistantClassroom(bottleneck, lessons, pool)));

    return bottlenecksHydrated;
}
export async function hydrateLargeGaps(bottlenecks : LargeGap[], lessons? : Lesson[], pool? : Pool) : Promise<LargeGapHydrated[]> {
    
    const bottlenecksHydrated : LargeGapHydrated[] = await Promise.all(bottlenecks.map(async (bottleneck) : Promise<LargeGapHydrated> => _hydrateDistantClassroom(bottleneck, lessons, pool)));

    return bottlenecksHydrated;
}
export function hydrateUnbalancedWeeks(bottlenecks : UnbalancedWeek[]) : UnbalancedWeekHydrated[] {

    return bottlenecks.map(bottleneck => { 
        return {
            start_date : bottleneck.start_date,
            lessons : bottleneck.lessons
        }
    });
}
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
function _lessonStrip(lesson : Lesson) : Lesson {

    return {
        location : lesson.location,
        summary : lesson.summary,
        start_date : lesson.start_date
    }
}