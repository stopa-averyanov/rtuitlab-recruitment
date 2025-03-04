import express from 'express'
import { pool } from "./db.js";
import { getJobResult, getJobStatus, JobStatus, requestAnalysisJob, requestSearchJob } from './job.js';
import { config } from 'node-config-ts';

const app = express();
app.disable('etag');

app.post('/jobs/submit/analysis/group/:remoteId/', (req, res) => {

    const groupId = parseInt(req.params.remoteId);

    if (String(groupId) !== req.params.remoteId || !Number.isFinite(groupId)) {

        res.status(400).end();
        return;
    }

    const jobId = requestAnalysisJob(1, groupId, pool);

    res.json({
        jobId : jobId
    })
});
app.post('/jobs/submit/analysis/prof/:remoteId/', (req, res) => {

    const profId = parseInt(req.params.remoteId);

    if (String(profId) !== req.params.remoteId || !Number.isFinite(profId)) {

        res.status(400).end();
        return;
    }
    
    const jobId = requestAnalysisJob(2, profId, pool);

    res.json({
        jobId : jobId
    })
});
app.post('/jobs/submit/search/', (req, res) => {
 
    const matchQuery : string | undefined = req.query.match ? String(req.query.match) : undefined;
    const limit : number | undefined = req.query.limit ? parseInt(String(req.query.limit)) : undefined;
    const pageToken : string | undefined = req.query.pageToken ? String(req.query.pageToken) : undefined;

    const jobId = requestSearchJob(pool, limit, matchQuery, pageToken);

    res.json({
        jobId : jobId
    })
});
app.get('/jobs/status/:jobId/', (req, res) => {

    const jobId = parseInt(req.params.jobId);

    if (String(jobId) !== req.params.jobId || !Number.isFinite(jobId)) {

        res.status(400).end();
        return;
    }

    res.json({
        status : getJobStatus(parseInt(req.params.jobId))
    })
});
app.get('/jobs/result/:jobId/', (req, res) => {
    
    const jobId = parseInt(req.params.jobId);

    if (String(jobId) !== req.params.jobId || !Number.isFinite(jobId)) {

        res.status(400).end();
        return;
    }

    const status = getJobStatus(jobId);

    switch (status) {
        case JobStatus.Processing:
            res.status(503).json({ "error" : "The job result cannot be retrieved as the job is being processed" });
            return;
        case JobStatus.NotFound:
            res.status(404).end({ "error" : "The job is not found (either not placed yet or has already been completed)" });
            return;
        case JobStatus.Error:
            res.status(500).end({ "error" : "An internal error occured while processing the job" });
            return;
    }

    const result = getJobResult(jobId);
    res.json(result);
});

app.listen(config.app.port);