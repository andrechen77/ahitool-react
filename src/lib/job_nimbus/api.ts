// functions for interacting with the JobNimbus API and parsing the responses

import { assertArray, assertObject } from "../types";
import { jnCacheLoadOrCalculate, jnCacheLoadOrCalculateStream } from "./indexed_db";
import { JobMilestone } from "./domain";
import type { JobBaseData, JobStatusRegistry, JobLeadSourceRegistry, JobStatus, MilestoneDates, JnActivity, JobLeadSource, JnActivityBase } from "./domain";

const API_BASE = import.meta.env.VITE_API_BASE ?? ""; // empty => same origin

export class ApiKeyError extends Error {
    /// The API key that was used when the error occurred, or null if one wa
    /// not provided.
    public key: string | null;

    constructor(message: string, key: string | null) {
        super(message);
        this.name = 'ApiKeyError';
        this.key = key;
    }
}

// always makes a fetch request
export async function requestFromJobNimbus(
    apiKey: string | null,
    endpoint: string,
    // headers: Record<string, string>,
    params: Record<string, string>
): Promise<Response> {
    if (apiKey === null) {
        throw new ApiKeyError('An API key is required to access JobNimbus data', null);
    }

    // calculate the url
    const queryString = params && Object.keys(params).length > 0
        ? '?' + new URLSearchParams(params).toString()
        : '';
    const url = `${API_BASE}/api/jobnimbus/api1/${endpoint}${queryString}`;

    // // get the api key
    // const token = localStorage.getItem('job_nimbus_api_key');
    // if (!token) {
    //     throw new ApiKeyError('No JobNimbus API key found', null);
    // }

    // fetch the data
    console.log(`fetching ${url} with params ${JSON.stringify(params)}`);
    const response = await fetch(
        url,
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                // ...headers,
            },
        }
    );
    if (response.status === 200) {
        console.log(`response for ${url} complete: ${response.status} ${response.statusText}`);
        return response;
    } else if (response.status === 401) {
        throw new ApiKeyError('Invalid JobNimbus API key', apiKey);
    } else {
        throw new Error(`Unexpected response from JobNimbus: ${response.status} ${response.statusText}`);
    }
}

// gets the contents of https://app.jobnimbus.com/api1/account/settings,
// possibly cached.
async function getSettings(apiKey: string | null): Promise<unknown> {
    return await jnCacheLoadOrCalculate("settings", async () => {
        return await requestFromJobNimbus(apiKey, "account/settings", {}).then(r => r.json());
    });
}

export async function getJobStatuses(apiKey: string | null): Promise<JobStatusRegistry> {
    const settings = await getSettings(apiKey);
    assertObject(settings);

    const allWorkflows = settings["workflows"];
    assertArray(allWorkflows);

    const workflows = allWorkflows.filter((w: any) => w["object_type"] === "job");
    assertArray(workflows);

    const statuses: JobStatusRegistry = workflows
        .flatMap((jobWorkflow: any) => jobWorkflow["status"])
        .reduce((acc: Record<number, JobStatus>, status: any) => {
            const id = Number(status["id"]);
            const name = String(status["name"]);
            acc[id] = { id, name };
            return acc;
        }, {});

    return statuses;
}

export async function getLeadSources(apiKey: string | null): Promise<JobLeadSourceRegistry> {
    const settings = await getSettings(apiKey);
    assertObject(settings);
    assertArray(settings["sources"]);

    const sources: JobLeadSourceRegistry = settings["sources"]
        .reduce((acc: Record<number, JobLeadSource>, source: any) => {
            const id = Number(source["JobSourceId"]);
            const name = String(source["SourceName"]);
            acc[id] = { id, name };
            return acc;
        }, {});

    return sources;
}

// repeatedly make requests from JobNimbus until all items are fetched
async function getAllFromJobNimbus(apiKey: string | null, endpoint: string, params: Record<string, string>, resultKey: string): Promise<unknown[]> {
    const maxPerPage = 1000;

    let results: unknown[] = [];
    let newResults: unknown[];
    do {
        params["size"] = String(maxPerPage);
        params["from"] = String(results.length);
        const response: unknown = await requestFromJobNimbus(apiKey, endpoint, params).then(r => r.json());
        assertObject(response);

        newResults = response[resultKey] as unknown[];
        assertArray(newResults);

        results.push(...newResults);
    } while (newResults.length >= maxPerPage);
    return results;
}

async function* getAllJobActivitiesUnparsedGenerator(apiKey: string | null): AsyncGenerator<unknown> {
    const endpoint = "activities";
    const resultKey = "activity";
    const maxPerRequest = 1000;
    // use this key to paginate; the API limits the number of records returned
    // (in terms of `from + size`) to 1000, so we need to do our own kind of
    // pagination
    const dateKey = "date_created";

    let earliestDate: Date = new Date();

    let lastNumRetrieved = 0;
    let seenJnids: Set<string> = new Set();
    let numRequests = 0;
    do {
        const params = {
            "size": String(maxPerRequest),
            "filter": JSON.stringify({
                "must": [
                    {
                        "term": {
                            "primary.type": "job"
                        }
                    },
                    {
                        "range": {
                            [dateKey]: {
                                "lte": Math.floor(earliestDate.getTime() / 1000),
                            }
                        }
                    }
                ]
            }),
        };
        const response: unknown = await requestFromJobNimbus(apiKey, endpoint, params).then(r => r.json());
        assertObject(response);
        const newResults = response[resultKey];
        assertArray(newResults);
        lastNumRetrieved = newResults.length;

        let nextSeenJnids = new Set<string>();
        for (const activity of newResults) {
            assertObject(activity);

            // yield the activity if we haven't seen it yet. at least one
            // activity of every query after the first one is a duplicate
            // because the date condition is <= instead of <
            const jnid = activity["jnid"] as string;
            if (!seenJnids.has(jnid)) {
                yield activity;
            }
            nextSeenJnids.add(jnid);

            // update the earliest date
            let dateCreated = new Date(Number(activity[dateKey]) * 1000);
            if (dateCreated < earliestDate) {
                earliestDate = dateCreated;
            }
        }

        numRequests++;
        seenJnids = nextSeenJnids;
    } while (numRequests < 100 && lastNumRetrieved >= maxPerRequest);
}

export async function* getAllJobActivitiesUnparsed(apiKey: string | null): AsyncGenerator<unknown> {
    yield* jnCacheLoadOrCalculateStream("activities", async function* () {
        yield* getAllJobActivitiesUnparsedGenerator(apiKey);
    });
}

export async function* getAllJobActivities(apiKey: string | null): AsyncGenerator<JnActivity> {
    const statuses = await getJobStatuses(apiKey);
    for await (const activity of getAllJobActivitiesUnparsed(apiKey)) {
        yield parseJnActivity(activity, statuses);
    }
}

export async function getAllJobBaseData(apiKey: string | null): Promise<JobBaseData[]> {
    const data = await jnCacheLoadOrCalculate("base_data", async () => {
        return await getAllFromJobNimbus(
            apiKey,
            "jobs",
            {},
            "results",
        );
    });
    const statuses = await getJobStatuses(apiKey);
    return data.map(job => parseJobBaseData(job, statuses));
}

function parseActivityBase(json: { [key: string]: unknown }): JnActivityBase {
    assertObject(json);

    const primary = json["primary"];
    assertObject(primary);

    if (primary["type"] !== "job")
        throw new Error("Activity is not for a job");

    if (typeof primary.id !== "string")
        throw new Error("Invalid activity: missing or invalid primary.id");
    const primaryJnid = primary.id;

    const dateCreatedUnknown = json["date_created"];
    if (typeof dateCreatedUnknown !== "number") {
        throw new Error("Invalid activity: missing or invalid date_created");
    }
    const timestamp = new Date(dateCreatedUnknown * 1000);

    const recordTypeName = json["record_type_name"];
    if (typeof recordTypeName !== "string") {
        throw new Error("Invalid activity: missing or invalid record_type_name");
    }

    const note = typeof json.note === "string" ? json.note : "";

    return {
        primaryJnid,
        timestamp,
        recordTypeName,
        note,
    };
}

function parseJobUpdates(text: string): { [key: string]: [string, string] } {
    if (!text.startsWith("Job Updated")) {
        return {};
    }

    // regex pattern to match "FIELDNAME: OLDVALUE => NEWVALUE"
    const pattern = /^([^:\n]+): ([^\n]*) => ([^\n]*)$/gm;
    const updates: { [key: string]: [string, string] } = {};

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const [_, fieldName, oldValue, newValue] = match;
        updates[fieldName] = [oldValue, newValue];
    }

    return updates;
}

// Parse a single activity from JSON
function parseJnActivity(
    json: unknown,
    statuses: JobStatusRegistry,
): JnActivity {
    assertObject(json);

    const base = parseActivityBase(json);

    try {
        switch (base.recordTypeName) {
            case "Job Created":
                return { ...base, type: "job_created" };
            case "Status Changed": {
                const jobInfo = json["primary"];
                assertObject(jobInfo);

                const oldStatusId = jobInfo["old_status"];
                const newStatusId = jobInfo["new_status"];

                let oldStatusName;
                let newStatusName;
                if (typeof oldStatusId === "number" && typeof newStatusId === "number") {
                    const oldStatus = statuses[oldStatusId];
                    const newStatus = statuses[newStatusId];
                    if (!oldStatus || !newStatus) {
                        throw new Error(
                            `Status not found: old=${oldStatusId}, new=${newStatusId}`,
                        );
                    }
                    oldStatusName = oldStatus.name;
                    newStatusName = newStatus.name;
                } else {
                    // fall back to trying to find the statuses in the note
                    const updates = parseJobUpdates(base.note);
                    const statusUpdate = updates["Status"];
                    if (statusUpdate) {
                        [oldStatusName, newStatusName] = statusUpdate;
                    } else {
                        return {
                            ...base,
                            type: "job_modified",
                            updates,
                        };
                    }
                }

                return {
                    ...base,
                    type: "status_changed",
                    oldStatusName,
                    newStatusName,
                };
            }
            case "Job Modified": {
                const updates = parseJobUpdates(base.note);
                return {
                    ...base,
                    type: "job_modified",
                    updates,
                };
            }
            default:
                return { ...base, type: "generic" };
        }
    } catch (error) {
        console.warn(
            `Unable to parse JobNimbus activity, falling back to generic: ${error}`,
        );
        return { ...parseActivityBase(json), type: "generic" };
    }
}

const RAW_JOB_BASE_DATA_KEYS = {
    JNID: "jnid",
    STATUS: "status",
    STATE: "state_text",
    DATE_CREATED: "date_created",
    DATE_STATUS_CHANGE: "date_status_change",
    SALES_REP_NAME: "sales_rep_name",
    INSURANCE_CHECKBOX: "Insurance Job?",
    INSURANCE_COMPANY_NAME: "Insurance Company",
    INSURANCE_CLAIM_NUMBER: "Claim #",
    JOB_NUMBER: "number",
    JOB_NAME: "name",
    AMT_RECEIVABLE: "approved_invoice_due",
    APPOINTMENT_DATE: "Sales Appt Date",
    CONTINGENCY_DATE: "Signed Contingency Date",
    CONTRACT_DATE: "Signed Contract Date",
    INSTALL_DATE: "Install Date",
    LOSS_DATE: "Job Lost Date (Lost Status)",
    LEAD_SOURCE_NAME: "source_name",
}

export function parseJobBaseData(
    raw: unknown,
    statuses: JobStatusRegistry,
): JobBaseData {
    assertObject(raw);

    const getNonEmptyString = (key: string): string | null => {
        const value = raw[key];
        return typeof value === "string" && value.trim() ? value : null;
    };
    const getTimestampNonZero = (key: string): Date | null => {
        const value = raw[key];
        if (typeof value === "number" && value !== 0) {
            const date = new Date(value * 1000);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        return null;
    };
    const getNumber = (key: string): number | null => {
        const value = raw[key];
        if (typeof value === "number") {
            return value;
        }
        return null;
    };

    const jnid = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.JNID);
    if (jnid === null) {
        throw new Error("Missing or invalid jnid field");
    }

    const createdDate = getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.DATE_CREATED);
    if (createdDate === null) {
        throw new Error("Missing or invalid date_created field");
    }

    // get the job status
    const statusIdValue = getNumber(RAW_JOB_BASE_DATA_KEYS.STATUS);
    const status = statusIdValue ? statuses[statusIdValue] : undefined;
    if (!status) {
        throw new Error(`Unknown status id: ${statusIdValue}`);
    }

    // get the last status update
    const statusModDate = getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.DATE_STATUS_CHANGE);

    const state = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.STATE) ?? "";
    if (state === "") {
        console.warn(`Missing or invalid state field for job ${jnid}`);
    }

    // optional fields
    const salesRep = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.SALES_REP_NAME);
    const insuranceCheckbox = Boolean(raw[RAW_JOB_BASE_DATA_KEYS.INSURANCE_CHECKBOX]);
    const insuranceCompanyName = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.INSURANCE_COMPANY_NAME);
    const insuranceClaimNumber = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.INSURANCE_CLAIM_NUMBER);
    const jobNumber = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.JOB_NUMBER);
    const jobName = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.JOB_NAME);
    const leadSourceName = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.LEAD_SOURCE_NAME);

    // get the amount receivable
    let amtReceivable = 0;
    const amountValue = raw[RAW_JOB_BASE_DATA_KEYS.AMT_RECEIVABLE];
    if (typeof amountValue === "number") {
        amtReceivable = Math.trunc(amountValue * 100);
    }

    // get milestone dates, keyed by milestone string value
    const milestoneDates: MilestoneDates = {
        [JobMilestone.LEAD_ACQUIRED]: null,
        [JobMilestone.APPOINTMENT_MADE]: getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.APPOINTMENT_DATE),
        [JobMilestone.CONTINGENCY_SIGNED]: getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.CONTINGENCY_DATE),
        [JobMilestone.CONTRACT_SIGNED]: getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.CONTRACT_DATE),
        [JobMilestone.INSTALLED]: getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.INSTALL_DATE),
        [JobMilestone.LOST]: getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.LOSS_DATE),
    };

    return {
        jnid,
        createdDate,
        state,
        milestoneDates,
        status,
        statusModDate,
        salesRep,
        insuranceCheckbox,
        insuranceClaimNumber,
        insuranceCompanyName,
        jobNumber,
        jobName,
        leadSourceName,
        amtReceivable,
    };
}
