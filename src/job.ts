import { Pool } from "pg";
import { processAnalysis, processSearch } from "./process.js";

export enum JobStatus {

    NotFound = 'not found',
    Processing = 'processing',
    Done = 'done',
    Error = 'error'
}

interface AnalysisRequest {

    targetType : number,
    remoteId : number
}
interface SearchRequest {

    limit? : number, 
    match? : string, 
    pageToken? : string
}

const results = new Map<number, AnalysisRequest | SearchRequest>();
const errors = new Array<number>();
const jobs = new Map<number, AnalysisRequest | SearchRequest>();

let jobIdCounter = 1;
let currentPromise = new Promise(() => {});

export function getJobStatus(jobId : number) : JobStatus {

    if (results.has(jobId)) return JobStatus.Done;
    if (errors.includes(jobId)) {

        errors.splice(errors.indexOf(jobId), 1);
        return JobStatus.Error;
    } 
    if (jobs.has(jobId)) return JobStatus.Processing;
    else return JobStatus.NotFound;
}

export function getJobResult(jobId : number) : undefined | AnalysisRequest | SearchRequest {

    if (results.has(jobId)) {

        jobs.delete(jobId);

        const result = results.get(jobId);
        results.delete(jobId);

        return result;
    }
    else return undefined;
}

export function requestAnalysisJob(targetType : number, remoteId : number, pool : Pool) : number {

    const request : AnalysisRequest = {
        targetType : targetType,
        remoteId : remoteId
    }

    return _jobSubmit(request, processAnalysis.bind(undefined, targetType, remoteId, pool));
}

export function requestSearchJob(pool : Pool, limit? : number, match? : string, pageToken? : string) : number {
    
    const request : SearchRequest = {
        limit : limit,
        match : match,
        pageToken : pageToken
    }

    return _jobSubmit(request, processSearch.bind(undefined, pool, limit, match, pageToken));
}

function _setJobResult(jobId : number, result : any) {

    if (result === undefined) {

        errors.push(jobId);
        jobs.delete(jobId);

    } else results.set(jobId, result)
}

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

function _jobFind(request : AnalysisRequest | SearchRequest) : number | undefined {

    for (const [jobId, job] of jobs.entries()) {

        if (JSON.stringify(job) === JSON.stringify(request)) return jobId;
    }
    return undefined;
}
