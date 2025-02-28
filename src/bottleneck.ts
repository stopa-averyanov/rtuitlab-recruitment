import { Pool } from "pg";
import { Target } from "./target.js";

export interface Bottlenecks {

    distantClassrooms : DistantClassroom[],
    largeGaps : LargeGap[],
    unbalancedWeeks : UnbalancedWeek[]
}

export interface DistantClassroom {

    readonly pk? : number;
    readonly target : number;
    readonly lesson_a : number;
    readonly lesson_b : number;
    readonly start_date : Date;
}

export interface LargeGap {
    
    readonly pk? : number;
    readonly target : number;
    readonly lesson_a : number;
    readonly lesson_b : number;
    readonly start_date : Date;
}

export interface UnbalancedWeek {

    readonly pk? : number;
    readonly target : number;
    readonly start_date : Date;
    readonly lessons : number[];
}

export async function bottlenecksFind(target : Target, pool : Pool) : Promise<Bottlenecks> {

    return {

        distantClassrooms : await distantClassroomsFind(target, pool),
        largeGaps : await largeGapsFind(target, pool),
        unbalancedWeeks : await unbalancedWeeksFind(target, pool)
    }
}
export async function bottlenecksClear(target : Target, pool : Pool) : Promise<void> {

    await distantClassroomsClear(target, pool);
    await largeGapsClear(target, pool);
    await unbalancedWeeksClear(target, pool);
}
export async function bottlenecksAdd(target : Target, bottlenecks : Bottlenecks, pool : Pool) : Promise<Bottlenecks> {

    return {

        distantClassrooms : await Promise.all(bottlenecks.distantClassrooms.map(bottleneck => distantClassroomAdd(target, bottleneck, pool))),
        largeGaps : await Promise.all(bottlenecks.largeGaps.map(bottleneck => largeGapAdd(target, bottleneck, pool))),
        unbalancedWeeks : await Promise.all(bottlenecks.unbalancedWeeks.map(bottleneck => unbalancedWeekAdd(target, bottleneck, pool))),
    }
}

export async function distantClassroomsFind(target : Target, pool : Pool): Promise<DistantClassroom[]> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 
                `SELECT * FROM distant_classrooms WHERE target = $1;`,
            values : [target.pk]
        }
        const response = await pool.query<DistantClassroom>(query);
    
        return response.rows;
    }
    
    else {
        const query = {
            text : 
                `SELECT 
                    bottleneck.*
                FROM 
                    targets target
                INNER JOIN distant_classrooms bottleneck
                    ON target.pk = bottleneck.target
                WHERE 
                    target.target_type = $1 and target.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<DistantClassroom>(query);
    
        return response.rows;
    }
}
export async function distantClassroomsClear(target : Target, pool : Pool) : Promise<void> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 'DELETE FROM distant_classrooms WHERE distant_classrooms.target = $1;',
            values : [target.pk]
        }
        const response = await pool.query<DistantClassroom>(query);
    }
    else {
        const query = {
            text : 
                `DELETE FROM distant_classrooms
                USING targets
                WHERE distant_classrooms.target = targets.pk
                AND targets.target_type = $1
                AND targets.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<DistantClassroom>(query);
    }
}
export async function distantClassroomAdd(target : Target, bottleneck : DistantClassroom, pool : Pool) : Promise<DistantClassroom> {

    if (target.pk !== undefined) {
        const query = {
            text : 
                `INSERT INTO distant_classrooms (target, lesson_a, lesson_b, start_date)
                VALUES ($1, $2, $3, $4)
                RETURNING *;`,
            values : [target.pk, bottleneck.lesson_a, bottleneck.lesson_b, bottleneck.start_date]
        }
        const response = await pool.query<DistantClassroom>(query);
        return response.rows[0];
    }
    else {
        const query = {
            text : 
                `INSERT INTO distant_classrooms (target, summary, location, start_date)
                VALUES (SELECT pk FROM targets WHERE target_type = $1 AND remote_id = $2 , $3, $4, $5)
                RETURNING *;`,
            values : [target.target_type, target.remote_id, bottleneck.lesson_a, bottleneck.lesson_b, bottleneck.start_date]
        }
        const response = await pool.query<DistantClassroom>(query);
        return response.rows[0];
    }
}
export async function distantClassroomRemove(bottleneck : DistantClassroom, pool : Pool) {

    if (bottleneck.pk !== undefined) {
        const query = {
            text : 'DELETE FROM distant_classrooms WHERE pk = $1',
            values : [bottleneck.pk]
        }
        await pool.query<DistantClassroom>(query);
    }
}

export async function largeGapsFind(target : Target, pool : Pool): Promise<LargeGap[]> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 
                `SELECT * FROM large_gaps WHERE target = $1;`,
            values : [target.pk]
        }
        const response = await pool.query<LargeGap>(query);
    
        return response.rows;
    }
    
    else {
        const query = {
            text : 
                `SELECT 
                    bottleneck.*
                FROM 
                    targets target
                INNER JOIN large_gaps bottleneck
                    ON target.pk = bottleneck.target
                WHERE 
                    target.target_type = $1 and target.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<LargeGap>(query);
    
        return response.rows;
    }
}
export async function largeGapsClear(target : Target, pool : Pool) : Promise<void> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 'DELETE FROM large_gaps WHERE large_gaps.target = $1;',
            values : [target.pk]
        }
        const response = await pool.query<LargeGap>(query);
    }
    else {
        const query = {
            text : 
                `DELETE FROM large_gaps
                USING targets
                WHERE large_gaps.target = targets.pk
                AND targets.target_type = $1
                AND targets.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<LargeGap>(query);
    }
}
export async function largeGapAdd(target : Target, bottleneck : LargeGap, pool : Pool) : Promise<LargeGap> {

    if (target.pk !== undefined) {
        const query = {
            text : 
                `INSERT INTO large_gaps (target, lesson_a, lesson_b, start_date)
                VALUES ($1, $2, $3, $4)
                RETURNING *;`,
            values : [target.pk, bottleneck.lesson_a, bottleneck.lesson_b, bottleneck.start_date]
        }
        const response = await pool.query<LargeGap>(query);
        return response.rows[0];
    }
    else {
        const query = {
            text : 
                `INSERT INTO large_gaps (target, summary, location, start_date)
                VALUES (SELECT pk FROM targets WHERE target_type = $1 AND remote_id = $2 , $3, $4, $5)
                RETURNING *;`,
            values : [target.target_type, target.remote_id, bottleneck.lesson_a, bottleneck.lesson_b, bottleneck.start_date]
        }
        const response = await pool.query<LargeGap>(query);
        return response.rows[0];
    }
}
export async function largeGapRemove(bottleneck : LargeGap, pool : Pool) {

    if (bottleneck.pk !== undefined) {
        const query = {
            text : 'DELETE FROM large_gaps WHERE pk = $1',
            values : [bottleneck.pk]
        }
        await pool.query<LargeGap>(query);
    }
}

export async function unbalancedWeeksFind(target : Target, pool : Pool): Promise<UnbalancedWeek[]> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 
                `SELECT * FROM unbalanced_weeks WHERE target = $1;`,
            values : [target.pk]
        }
        const response = await pool.query<UnbalancedWeek>(query);
    
        return response.rows;
    }
    
    else {
        const query = {
            text : 
                `SELECT 
                    bottleneck.*
                FROM 
                    targets target
                INNER JOIN unbalanced_weeks bottleneck
                    ON target.pk = bottleneck.target
                WHERE 
                    target.target_type = $1 and target.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<UnbalancedWeek>(query);
    
        return response.rows;
    }
}
export async function unbalancedWeeksClear(target : Target, pool : Pool) : Promise<void> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 'DELETE FROM unbalanced_weeks WHERE unbalanced_weeks.target = $1;',
            values : [target.pk]
        }
        const response = await pool.query<UnbalancedWeek>(query);
    }
    else {
        const query = {
            text : 
                `DELETE FROM unbalanced_weeks
                USING targets
                WHERE unbalanced_weeks.target = targets.pk
                AND targets.target_type = $1
                AND targets.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<UnbalancedWeek>(query);
    }
}
export async function unbalancedWeekAdd(target : Target, bottleneck : UnbalancedWeek, pool : Pool) : Promise<UnbalancedWeek> {

    if (target.pk !== undefined) {
        const query = {
            text : 
                `INSERT INTO unbalanced_weeks (target, start_date, lessons)
                VALUES ($1, $2, $3)
                RETURNING *;`,
            values : [target.pk, bottleneck.start_date, bottleneck.lessons]
        }
        const response = await pool.query<UnbalancedWeek>(query);
        return response.rows[0];
    }
    else {
        const query = {
            text : 
                `INSERT INTO unbalanced_weeks (target, start_date, lessons)
                VALUES (SELECT pk FROM targets WHERE target_type = $1 AND remote_id = $2 , $3, $4)
                RETURNING *;`,
            values : [target.target_type, target.remote_id, bottleneck.start_date, bottleneck.lessons]
        }
        const response = await pool.query<UnbalancedWeek>(query);
        return response.rows[0];
    }
}
export async function unbalancedWeekRemove(bottleneck : UnbalancedWeek, pool : Pool) {

    if (bottleneck.pk !== undefined) {
        const query = {
            text : 'DELETE FROM unbalanced_weeks WHERE pk = $1',
            values : [bottleneck.pk]
        }
        await pool.query<UnbalancedWeek>(query);
    }
}