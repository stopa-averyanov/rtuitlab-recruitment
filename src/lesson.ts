import { Pool } from "pg";
import { Target } from "./target.js"
import ICAL from 'ical.js'

/**
 * Объект, содержащий информацию о занятии
 * 
 * Может указывать на соответствующий объект в базе данных, если поле {@link pk} заполнено
 */
export interface Lesson {

    /**
     * Первичный ключ занятия в базе данных (если внесено)
     */
    readonly pk? : number;
    /**
     * Сущность, которой принадлежит занятие
     */
    readonly target? : number;
    /**
     * Аудитория, в которой располагается занятие
     */
    readonly location : string;
    /**
     * Описание занятия
     */
    readonly summary : string;
    /**
     * Дата и время начала занятия
     */
    readonly start_date : Date;
}

/**
 * Находит и возвращает в базе данных все занятия у сущности
 * 
 * @param target Сущность, занятия которой нужно найти
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Список с найденными занятиями
 */
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

/**
 * Находит и возвращает в базе данных занятие у сущности по первичному ключу
 * 
 * @param target Сущность, занятие которой нужно найти
 * @param pk Первичный ключ занятия
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Занятие, если найдено, `undefined` иначе
 */
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

/**
 * Удаляет в базе данных все занятия у сущности
 * 
 * @param target Сущность, занятия которой нужно очистить 
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 */
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

/**
 * Добавляет в базу данных занятие к сущности
 * 
 * @param target Сущность, которой нужно добавить занятие
 * @param lesson Занятие, которое нужно добавить
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Новый объект {@link Lesson `Lesson`} с заполненным полем {@link Target.pk `pk`}
 */
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

/**
 * Добавляет в базу данных занятия к сущности
 * 
 * @param target Сущность, которой нужно добавить занятия
 * @param lesson[] Занятия, которое нужно добавить
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Список новых объектов {@link Lesson `Lesson`} с заполненными полями {@link Target.pk `pk`}
 */
export async function lessonsAdd(target : Target, lessons : Lesson[], pool : Pool) : Promise<Lesson[]> {
    
    return Promise.all(lessons.map(lesson => lessonAdd(target, lesson, pool)));
}

/**
 * Удаляет из базы данных занятие
 * 
 * @param lesson Занятие, которое нужно удалить
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 */
export async function lessonRemove(lesson : Lesson, pool : Pool) {

    if (lesson.pk !== undefined) {
        const query = {
            text : 'DELETE FROM lessons WHERE pk = $1',
            values : [lesson.pk]
        }
        await pool.query<Lesson>(query);
    }
}

/**
 * Создает занятие на основе события ICAL
 * 
 * @param event `ICAL.Event`-объект, из которого нужно построить занятие
 * @returns Созданное занятие
 */
export function lessonFromEvent(event : ICAL.Event) : Lesson {

    return {
        location : event.location,
        summary : event.summary,
        start_date : event.startDate.toJSDate()
    }
}