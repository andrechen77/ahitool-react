import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiKeyError, getAllJobActivities, getAllJobBaseData, getJobStatuses, getLeadSources } from '../lib/job_nimbus/api';
import type { JnActivity, JobBaseData, JobStatusRegistry, JobLeadSourceRegistry } from '../lib/job_nimbus/domain';
import { jnCacheClear } from '../lib/job_nimbus/indexed_db';

export interface JobNimbusData {
	activitiesByJobJnid: Record<string, JnActivity[]>;
	jobsByJnid: Record<string, JobBaseData>;
	statuses: JobStatusRegistry;
	leadSources: JobLeadSourceRegistry;
	states: string[];
	salesReps: string[];
}

export const DEFAULT_JN_DATA: JobNimbusData = {
	activitiesByJobJnid: {},
	jobsByJnid: {},
	statuses: {},
	leadSources: {},
	states: [],
	salesReps: [],
};

interface JobNimbusDataContextType {
	data: JobNimbusData | null;
	isLoading: boolean;
	refresh: (apiKey: string | null) => Promise<void>;
}


const JobNimbusDataContext = createContext<JobNimbusDataContextType | undefined>(undefined);

export function JobNimbusDataProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<JobNimbusData | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const refresh = async (apiKey: string | null) => {
		setIsLoading(true);

		try {
			if (apiKey !== null) {
				await jnCacheClear();
				if (apiKey.length !== 16) {
					throw new ApiKeyError('Invalid API key', apiKey);
				}
			}

			setData(null);

			const statuses = await getJobStatuses(apiKey);
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				statuses,
			}));

			const leadSources = await getLeadSources(apiKey);
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				leadSources,
			}));

			const jobs = await getAllJobBaseData(apiKey);
			const jobsByJnidMap = jobs.reduce((acc, job) => {
				acc[job.jnid] = job;
				return acc;
			}, {} as Record<string, JobBaseData>);
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				jobsByJnid: jobsByJnidMap,
			}));

			let activitiesByJnid: Record<string, JnActivity[]> = {};
			let lastUpdate = new Date();
			for await (const activity of getAllJobActivities(apiKey)) {
				const jnid = activity.primaryJnid;
				if (!activitiesByJnid[jnid]) {
					activitiesByJnid[jnid] = [];
				}
				activitiesByJnid[jnid].push(activity);

				// intermittently provide some feedback to the user
				const now = new Date();
				if (now.getTime() - lastUpdate.getTime() > 500) {
					lastUpdate = now;
					setData(prev => ({
						...(prev ?? DEFAULT_JN_DATA),
						activitiesByJobJnid: activitiesByJnid,
					}));
				}
			}
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				activitiesByJobJnid: activitiesByJnid,
			}));

			const states = Array.from(new Set(jobs.map(job => job.state)));
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				states: states,
			}));

			const salesReps = Array.from(new Set(jobs.map(job => job.salesRep).filter(rep => rep !== null)));
			setData(prev => ({
				...(prev ?? DEFAULT_JN_DATA),
				salesReps: salesReps,
			}));

		} finally {
			setIsLoading(false);
		}
	};

	const value: JobNimbusDataContextType = {
		data,
		isLoading,
		refresh,
	};

	return (
		<JobNimbusDataContext.Provider value={value}>
			{children}
		</JobNimbusDataContext.Provider>
	);
}

export function useJobNimbusData(): JobNimbusDataContextType {
	const context = useContext(JobNimbusDataContext);
	if (context === undefined) {
		throw new Error('useJobNimbusData must be used within a JobNimbusDataProvider');
	}
	return context;
}
