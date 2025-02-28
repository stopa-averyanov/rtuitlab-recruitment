import { bottlenecksFromLessons } from "./analysis.js";
import { Bottlenecks, bottlenecksAdd, bottlenecksClear, bottlenecksFind } from "./bottleneck.js";
import { fetchCalendarJSON, fetchTargets, generateMD5, parseLessons } from "./fetch.js";
import { BottlenecksHydrated, hydrateBottlenecks, hydrateSearchResult, SearchResultHydrated } from "./hydrate.js";
import { Lesson, lessonsAdd, lessonsClear } from "./lesson.js";
import { targetGetMD5, targetGetOrCreate, targetSetMD5 } from "./target.js";
import { config } from "node-config-ts";
import { Pool } from 'pg';

export async function processAnalysis(targetType : number, remoteId : number, pool : Pool) : Promise<BottlenecksHydrated | undefined> {
    
    const target = await targetGetOrCreate({ target_type : targetType, remote_id : remoteId }, pool);
    
    const jsonObject = await fetchCalendarJSON(target);

    if (jsonObject === undefined) return;
    
    const checksum = generateMD5(jsonObject)
    
    if (!config.app.doChecksumCheck || await targetGetMD5(target, pool) !== checksum) {
    
        await lessonsClear(target, pool);
        await bottlenecksClear(target, pool);
    
        const lessons : Lesson[] = parseLessons(jsonObject);
        const lessonsInserted = await lessonsAdd(target, lessons, pool);
    
        const bottlenecks : Bottlenecks = bottlenecksFromLessons(lessonsInserted);
        const bottlenecksInserted = await bottlenecksAdd(target, bottlenecks, pool);
    
        await targetSetMD5(target, checksum, pool);

        return hydrateBottlenecks(bottlenecksInserted, lessonsInserted);
    }
    else {
    
        const bottlenecks : Bottlenecks = await bottlenecksFind(target, pool);
        return hydrateBottlenecks(bottlenecks, undefined, pool);
    }
}
export async function processSearch(pool : Pool, limit? : number, match? : string, pageToken? : string) : Promise<SearchResultHydrated | undefined> {

    const searchResult = await fetchTargets(limit, match, pageToken);
    if (searchResult === undefined) return undefined;
    return await hydrateSearchResult(searchResult, pool);
}