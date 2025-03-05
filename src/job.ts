import { Pool } from "pg";
import { processAnalysis, processSearch } from "./process.js";

// TODO : fix types for job results (currently request types, should be bottlenecks and search results)

/**
 * Перечисление возможных статусов задачи
 */
export enum JobStatus {

    /** Задача не найдена (еще не создана или уже завершена) */
    NotFound = 'not found',
    /** Задача в обработке */
    Processing = 'processing',
    /** Задача завершена, но результат еще не был передан */
    Done = 'done',
    /** Во время выполнения задачи возникла ошибка */
    Error = 'error'
}

/**
 * Объект, содержащий информацию о запросе клиента на анализ
 */
interface AnalysisRequest {

    /** Тип сущности */
    targetType : number,
    /** Айди сущности на удаленном API */
    remoteId : number
}
/**
 * Объект, содержащий информацию о запросе клиента на поиск
 */
interface SearchRequest {

    /** Ограничение по количеству результатов поиска */
    limit? : number, 
    /** Строка, поиск по включению которой нужно выполнить */
    match? : string, 
    /** Токен следующей страницы (при повторных запросах) */
    pageToken? : string
}

/** Словарь результатов выполненных задач по их идентификаторам */
const results = new Map<number, AnalysisRequest | SearchRequest>();
/** Список идентификаторов задач, которые завершились ошибкой */
const errors = new Array<number>();
/** Список задач: словарь запросов клиента по идентификаторам соответствующих задач */
const jobs = new Map<number, AnalysisRequest | SearchRequest>();

/** Счетчик идентификаторов задач */
let jobIdCounter = 1;
/** `Promise`-объект последней в очереди задачи */
let currentPromise = new Promise(() => {});

/**
 * Получает статус задачи по идентификатору
 * 
 * @param jobId Идентификатор задачи
 * @returns Статус задачи
 */
export function getJobStatus(jobId : number) : JobStatus {

    if (results.has(jobId)) return JobStatus.Done;
    if (errors.includes(jobId)) {

        errors.splice(errors.indexOf(jobId), 1);
        return JobStatus.Error;
    } 
    if (jobs.has(jobId)) return JobStatus.Processing;
    else return JobStatus.NotFound;
}

/**
 * Получает результат задачи (если выполнена) по идентификатору
 * 
 * @param jobId Идентификатор задачи
 * @returns Результат выполнения задачи если выполнена, `undefined` иначе
 */
export function getJobResult(jobId : number) : undefined | AnalysisRequest | SearchRequest {

    if (results.has(jobId)) {

        jobs.delete(jobId);

        const result = results.get(jobId);
        results.delete(jobId);

        return result;
    }
    else return undefined;
}

/**
 * Создает задачу анализа расписания
 * 
 * @param targetType Тип сущности, анализ расписания которой нужно выполнить
 * @param remoteId Айди сущности на удаленном API
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @returns Идентификатор созданной задачи
 */
export function requestAnalysisJob(targetType : number, remoteId : number, pool : Pool) : number {

    const request : AnalysisRequest = {
        targetType : targetType,
        remoteId : remoteId
    }

    return _jobSubmit(request, processAnalysis.bind(undefined, targetType, remoteId, pool));
}

/**
 * Создает задачу поиска и анализа
 * 
 * @param pool Пул соединений, через которые выполняется запрос в базу данных
 * @param limit Ограничение по количеству результатов поиска
 * @param match Строка, поиск по включению которой нужно выполнить
 * @param pageToken Токен следующей страницы (при повторных запросах)
 * @returns Идентификатор созданной задачи
 */
export function requestSearchJob(pool : Pool, limit? : number, match? : string, pageToken? : string) : number {
    
    const request : SearchRequest = {
        limit : limit,
        match : match,
        pageToken : pageToken
    }

    return _jobSubmit(request, processSearch.bind(undefined, pool, limit, match, pageToken));
}

/**
 * Завершает задачу и сохраняет результат ее выполнения
 * 
 * @param jobId Идентификатор задачи
 * @param result Результат задачи, если успешно завершена, `undefined` иначе
 */
function _setJobResult(jobId : number, result : any) {

    if (result === undefined) {

        errors.push(jobId);
        jobs.delete(jobId);

    } else results.set(jobId, result)
}

/**
 * Создает задачу с произвольной функцией
 * 
 * @param request Объект запроса клиента, которому соответствует задача
 * @param requestCallback Функция, реализующая выполнение задачи
 * @returns Идентификатор созданной задачи
 */
function _jobSubmit(request : AnalysisRequest | SearchRequest, requestCallback : () => any) : number {
    
    const existingJobId = _jobFind(request);
    if (existingJobId !== undefined) return existingJobId;

    const jobId = jobIdCounter;
    jobIdCounter++;

    const jobCallback = async () : Promise<void> => {

        try {

            _setJobResult(jobId, await requestCallback());
        }
        catch (error) {

            errors.push(jobId);
            
            console.log(`Error processing job #${jobId}`);
            console.log('Request:');
            console.log(JSON.stringify(request, null, 4));
            console.log('Error:');
            console.log(error);
        }
    }

    if (jobs.size === 0) {

        currentPromise = jobCallback();
        jobs.set(jobId, request);
        return jobId;
    }
    else {

        currentPromise = currentPromise.then(jobCallback);
        jobs.set(jobId, request);
        return jobId;
    }
}

/**
 * Находит задачу по запросу клиента
 * 
 * @param request Запрос клиента, по которому нужно найти задачу
 * @returns Идентификатор задачи, если запрос повторяется, `undefined` иначе
 */
function _jobFind(request : AnalysisRequest | SearchRequest) : number | undefined {

    for (const [jobId, job] of jobs.entries()) {

        if (JSON.stringify(job) === JSON.stringify(request)) return jobId;
    }
    return undefined;
}
