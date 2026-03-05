// functions for interacting with the JobNimbus API and parsing the responses

import { assertArray, assertObject } from "../types";
import { cachedOrCalculate } from "./indexed_db";
import { JobMilestone } from "./domain";
import type { JobBaseData, JobStatusRegistry, JobLeadSourceRegistry, JobStatus, MilestoneDates, JnActivity, JobLeadSource, JnActivityBase } from "./domain";

export class ApiKeyError extends Error {
    /// The API key that was used when the error occurred, or null if one wa
    /// not provided.
    public key: string | null;

    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyError';
        this.key = null;
    }
}

// always makes a fetch request
export async function requestFromJobNimbus(
    endpoint: string,
    // headers: Record<string, string>,
    params: Record<string, string>
): Promise<Response> {
    // calculate the url
    const queryString = params && Object.keys(params).length > 0
        ? '?' + new URLSearchParams(params).toString()
        : '';
    const url = `http://localhost:8080/api1/${endpoint}${queryString}`;

    // get the api key
    const token = localStorage.getItem('job_nimbus_api_key');
    if (!token) {
        throw new ApiKeyError('No JobNimbus authentication token found in localStorage (job_nimbus_api_key)');
    }

    // fetch the data
    console.log(`fetching ${url} with params ${JSON.stringify(params)}`);
    const response = await fetch(
        url,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                // ...headers,
            },
        }
    );
    console.log(`response for ${url} complete: ${response.status} ${response.statusText}`);
    return response;
}

// gets the contents of https://app.jobnimbus.com/api1/account/settings,
// possibly cached
async function getSettings(): Promise<unknown> {
    return await cachedOrCalculate("settings", async () => {
        return await requestFromJobNimbus("account/settings", {}).then(r => r.json());
    });
}

export async function getJobStatuses(): Promise<JobStatusRegistry> {
    const settings = await getSettings();
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

export async function getLeadSources(): Promise<JobLeadSourceRegistry> {
    const settings = await getSettings();
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
async function getAllFromJobNimbus(endpoint: string, params: Record<string, string>, resultKey: string): Promise<unknown[]> {
    const maxPerPage = 1000;

    let results: unknown[] = [];
    let newResults: unknown[];
    do {
        params["size"] = String(maxPerPage);
        params["from"] = String(results.length);
        const response: unknown = await requestFromJobNimbus(endpoint, params).then(r => r.json());
        assertObject(response);

        newResults = response[resultKey] as unknown[];
        assertArray(newResults);

        results.push(...newResults);
    } while (newResults.length >= maxPerPage);
    return results;
}

export async function getAllJobActivitiesUnparsed(): Promise<unknown[]> {
    return await cachedOrCalculate("activities", async () => {
        return await getAllFromJobNimbus(
            "activities",
            {
                "filter": JSON.stringify({
                    "must": [
                        {
                            "term": {
                                "is_status_change": true,
                            },
                        },
                        {
                            "term": {
                                "primary.type": "job"
                            }
                        },
                    ]
                })
            },
            "activity",
        );
    });
}

export async function getAllJobActivities(): Promise<JnActivity[]> {
    const activities = await getAllJobActivitiesUnparsed();
    const statuses = await getJobStatuses();
    return activities.map(activity => parseJnActivity(activity, statuses));
}

export async function getAllJobBaseData(): Promise<JobBaseData[]> {
    const data = await cachedOrCalculate("base_data", async () => {
        return await getAllFromJobNimbus(
            "jobs",
            {},
            "results",
        );
    });
    const statuses = await getJobStatuses();
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

    const text = typeof json.note === "string" ? json.note : "";

    return {
        primaryJnid,
        timestamp,
        recordTypeName,
        text,
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

                if (typeof oldStatusId !== "number" || typeof newStatusId !== "number") {
                    throw new Error("Missing or invalid status IDs in status change activity");
                }

                const oldStatus = statuses[oldStatusId];
                const newStatus = statuses[newStatusId];

                if (!oldStatus || !newStatus) {
                    throw new Error(
                        `Status not found: old=${oldStatusId}, new=${newStatusId}`,
                    );
                }

                return {
                    ...base,
                    type: "status_changed",
                    oldStatus,
                    newStatus,
                };
            }
            case "Job Modified": {
                const updates = parseJobUpdates(base.text);
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

    // get the job status
    const statusIdValue = getNumber(RAW_JOB_BASE_DATA_KEYS.STATUS);
    const status = statusIdValue ? statuses[statusIdValue] : undefined;
    if (!status) {
        throw new Error(`Unknown status id: ${statusIdValue}`);
    }

    // get the last status update
    const statusModDate = getTimestampNonZero(RAW_JOB_BASE_DATA_KEYS.DATE_STATUS_CHANGE);

    // optional fields
    const salesRep = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.SALES_REP_NAME);
    const insuranceCheckbox = Boolean(raw[RAW_JOB_BASE_DATA_KEYS.INSURANCE_CHECKBOX]);
    const insuranceCompanyName = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.INSURANCE_COMPANY_NAME);
    const insuranceClaimNumber = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.INSURANCE_CLAIM_NUMBER);
    const jobNumber = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.JOB_NUMBER);
    const jobName = getNonEmptyString(RAW_JOB_BASE_DATA_KEYS.JOB_NAME);

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
        milestoneDates,
        status,
        statusModDate,
        salesRep,
        insuranceCheckbox,
        insuranceClaimNumber,
        insuranceCompanyName,
        jobNumber,
        jobName,
        amtReceivable,
    };
}
