// type definitions for JobNimbus domain objects

export const JobMilestone = {
    LEAD_ACQUIRED: "Lead Acquired",
    APPOINTMENT_MADE: "Appointment Made",
    CONTINGENCY_SIGNED: "Contingency Signed",
    CONTRACT_SIGNED: "Contract Signed",
    INSTALLED: "Installed",
    LOST: "Lost",
} as const;
export type JobMilestone = (typeof JobMilestone)[keyof typeof JobMilestone];

export interface JobStatus {
    id: number;
    name: string;
}

export type JobStatusRegistry = Record<number, JobStatus>;

// export const JobInsuranceStatus = {
//     INSURANCE_WITH_CONTINGENCY: "Insurance With Contingency",
//     INSURANCE_WITHOUT_CONTINGENCY: "Insurance Without Contingency",
//     RETAIL: "Retail",
// } as const;
// export type JobInsuranceStatus = (typeof JobInsuranceStatus)[keyof typeof JobInsuranceStatus];

export type MilestoneDates = Record<JobMilestone, Date | null>;

export interface JobLeadSource {
    id: number;
    name: string;
}
export type JobLeadSourceRegistry = Record<number, JobLeadSource>;

export interface JobBaseData {
    jnid: string;
    milestoneDates: MilestoneDates;
    status: JobStatus;
    statusModDate?: Date | null;
    salesRep?: string | null;
    insuranceCheckbox: boolean;
    insuranceClaimNumber?: string | null;
    insuranceCompanyName?: string | null;
    jobNumber?: string | null;
    jobName?: string | null;
    // amount in cents
    amtReceivable: number;
}

export interface JnActivityBase {
    primaryJnid: string;
    timestamp: Date;
    recordTypeName: string;
    text: string;
}
export type JnActivity = JnActivityBase & (
    | { type: "generic" }
    | { type: "job_created" }
    | { type: "status_changed"; oldStatus: JobStatus; newStatus: JobStatus }
    | { type: "job_modified"; updates: { [key: string]: [string, string] } }
)
