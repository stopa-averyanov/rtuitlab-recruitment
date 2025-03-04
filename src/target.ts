import { Pool } from "pg";
import { lessonsClear } from "./lesson.js";
import { bottlenecksClear } from "./bottleneck.js";

/**
 * Объект, содержащий информацию о сущности, которая может иметь расписание
 * 
 * Может указывать на соответствующий объект в базе данных, если поле {@link pk `pk`} заполнено
 */
export interface Target {

    /**
     * Первичный ключ сущности в базе данных (если внесена)
     */
    readonly pk? : number;
    /**
     * Тип сущности, соответствующий типам в удаленном API
     * (`1` — группа, `2` — преподаватель)
     */
    readonly target_type : number;
    /**
     * Айди сущности в удаленном API
     */
    readonly remote_id : number;
    /**
     * Чек-сумма сущности в базе данных
     */
    readonly md5? : string
}

/**
 * Проверяет, существует ли сущность в базе данных по типу и группе
 * 
 * @param target Сущность, которую нужно найти в базе данных по типу и группе
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Новый объект {@link Target `Target`} с заполненным полем {@link Target.pk `pk`} если найден, `undefined` иначе
 */
export async function targetExists(target : Target, pool : Pool) : Promise<Target | undefined> {

    const query = {
        text : 'SELECT * FROM targets WHERE target_type = $1 and remote_id = $2;',
        values : [target.target_type, target.remote_id]
    }
    const response = await pool.query<Target>(query);

    return response.rows[0];
}

/**
 * Находит сущность в базе данных по первичному ключу
 * 
 * @param pk Первичный ключ сущности
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Сущность в объекте {@link Target `Target`} если найдена, `undefined` иначе
 */
export async function targetFind(pk : number, pool : Pool) : Promise<Target | undefined> {

    const query = {
        text : 'SELECT * FROM targets WHERE pk = $1;',
        values : [pk]
    }
    const response = await pool.query<Target>(query);

    return response.rows[0];
}

/**
 * Создает сущность в базе данных. Если такая уже существует, находит ее и возвращает
 * 
 * @param target Сущность, которую нужно создать (или найти) в базе данных
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Созданная или найденная, уже существующая сущность в объекте `Target`
 */
export async function targetGetOrCreate(target : Target, pool : Pool) : Promise<Target> { 

    const oldTarget = await targetExists(target, pool);
    
    if (oldTarget !== undefined) {
        return oldTarget;
    }

    const query = {
        text : 'INSERT INTO targets (target_type, remote_id) VALUES ($1, $2) RETURNING *;',
        values : [target.target_type, target.remote_id]
    }
    const response = await pool.query<Target>(query);
    await lessonsClear(response.rows[0], pool);
    await bottlenecksClear(response.rows[0], pool);
    return response.rows[0];
}

/**
 * Находит чек-сумму сущности в базе данных
 * 
 * @param target Сущность, чек-сумму которой нужно найти
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Чек-сумма, если сущность найдена, `undefined` иначе
 */
export async function targetGetMD5(target : Target, pool : Pool) : Promise<string | undefined> {

    if (target.pk !== undefined) {

        const query = {
            text : 'SELECT md5 FROM targets WHERE pk = $1;',
            values : [target.pk]
        }
        const response = await pool.query<Target>(query);
    
        return response.rows[0].md5 ?? undefined;
    }
    else {

        const query = {
            text : 'SELECT md5 FROM targets WHERE target_type = $1 AND remote_id = $2;',
            values : [target.target_type, target.remote_id]
        }
        const response = await pool.query<Target>(query);
    
        return response.rows[0].md5 ?? undefined;
    }
    
}

/**
 * Обновляет чек-сумму сущности в базе данных
 * 
 * @param target Сущность, чек-сумму которой нужно обновить
 * @param md5 Новая чек-сумма в формате uuid
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Обновленная сущность с заданной чек-суммой
 */
export async function targetSetMD5(target : Target, md5 : string, pool : Pool) : Promise<Target> {

    const query = {
        text : 'UPDATE targets SET md5 = $1 WHERE target_type = $2 AND remote_id = $3 RETURNING *',
        values : [md5, target.target_type, target.remote_id]
    }
    const response = await pool.query<Target>(query);
    return response.rows[0];
}

export async function targetDelete(target : Target, pool : Pool) {

    const oldTarget = await targetExists(target, pool);

    if (oldTarget !== undefined) {

        await bottlenecksClear(oldTarget, pool);
        await lessonsClear(oldTarget, pool);
        
        const query = {
            text : 'DELETE FROM targets WHERE pk = $1;',
            values : [oldTarget.pk]
        }
        const response = await pool.query<Target>(query);
    }
}