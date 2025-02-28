import { Pool } from "pg";
import { lessonsClear } from "./lesson.js";
import { bottlenecksClear } from "./bottleneck.js";

export interface Target {

    readonly pk? : number;
    readonly target_type : number;
    readonly remote_id : number;
    readonly md5? : string
}

export async function targetExists(target : Target, pool : Pool) : Promise<Target | undefined> {

    const query = {
        text : 'SELECT * FROM targets WHERE target_type = $1 and remote_id = $2;',
        values : [target.target_type, target.remote_id]
    }
    const response = await pool.query<Target>(query);

    return response.rows[0];
}
export async function targetFind(pk : number, pool : Pool) : Promise<Target | undefined> {

    const query = {
        text : 'SELECT * FROM targets WHERE pk = $1;',
        values : [pk]
    }
    const response = await pool.query<Target>(query);

    return response.rows[0];
}

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