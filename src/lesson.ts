import { Pool } from "pg";
import { Target } from "./target.js"
import ICAL from 'ical.js'

export interface Lesson {

    readonly pk? : number;
    readonly target? : number;
    readonly location : string;
    readonly summary : string;
    readonly start_date : Date;
}
export interface Location { 

    readonly building : string;
    readonly classroom : string;
    readonly campus : string;
}

export async function lessonsFind(target : Target, pool : Pool): Promise<Lesson[]> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 
                `SELECT * FROM lessons WHERE target = $1;`,
            values : [target.pk]
        }
        const response = await pool.query<Lesson>(query);
    
        return response.rows;
    }
    
    else {
        const query = {
            text : 
                `SELECT 
                    lesson.*
                FROM 
                    targets target
                INNER JOIN lessons lesson
                    ON target.pk = lesson.target
                WHERE 
                    target.target_type = $1 and target.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<Lesson>(query);
    
        return response.rows;
    }
}
export async function lessonFind(target : Target, pk : number, pool : Pool): Promise<Lesson | undefined> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 
                `SELECT * FROM lessons WHERE target = $1 AND pk = $2;`,
            values : [target.pk, pk]
        }
        const response = await pool.query<Lesson>(query);
    
        return response.rows[0];
    }
    
    else {
        const query = {
            text : 
                `SELECT 
                    lesson.*
                FROM 
                    targets target
                INNER JOIN lessons lesson
                    ON target.pk = lesson.target
                WHERE 
                    target.target_type = $1 AND target.remote_id = $2 AND lesson.pk = $3;`,
            values : [target.target_type, target.remote_id, pk]
        }
        const response = await pool.query<Lesson>(query);
    
        return response.rows[0];
    }
}
export async function lessonsClear(target : Target, pool : Pool) : Promise<void> {
    
    if (target.pk !== undefined) {
        const query = {
            text : 'DELETE FROM lessons WHERE lessons.target = $1;',
            values : [target.pk]
        }
        const response = await pool.query<Lesson>(query);
    }
    else {
        const query = {
            text : 
                `DELETE FROM lessons
                USING targets
                WHERE lessons.target = targets.pk
                AND targets.target_type = $1
                AND targets.remote_id = $2;`,
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<Lesson>(query);
    }
}
export async function lessonAdd(target : Target, lesson : Lesson, pool : Pool) : Promise<Lesson> {

    if (target.pk !== undefined) {
        const query = {
            text : 
                `INSERT INTO lessons (target, summary, location, start_date)
                VALUES ($1, $2, $3, $4)
                RETURNING *;`,
            values : [target.pk, lesson.summary, lesson.location, lesson.start_date]
        }
        const response = await pool.query<Lesson>(query);
        return response.rows[0];
    }
    else {
        const query = {
            text : 
                `INSERT INTO lessons (target, summary, location, start_date)
                VALUES (SELECT pk FROM targets WHERE target_type = $1 AND remote_id = $2 , $3, $4, $5)
                RETURNING *;`,
            values : [target.target_type, target.remote_id, lesson.summary, lesson.location, lesson.start_date]
        }
        const response = await pool.query<Lesson>(query);
        return response.rows[0];
    }
}
export async function lessonsAdd(target : Target, lessons : Lesson[], pool : Pool) : Promise<Lesson[]> {
    
    return Promise.all(lessons.map(lesson => lessonAdd(target, lesson, pool)));
}
export async function lessonRemove(lesson : Lesson, pool : Pool) {

    if (lesson.pk !== undefined) {
        const query = {
            text : 'DELETE FROM lessons WHERE pk = $1',
            values : [lesson.pk]
        }
        await pool.query<Lesson>(query);
    }
}
export function lessonFromEvent(event : ICAL.Event) : Lesson {

    return {
        location : event.location,
        summary : event.summary,
        start_date : event.startDate.toJSDate()
    }
}