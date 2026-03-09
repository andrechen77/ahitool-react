import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { getAllJobActivities, getAllJobBaseData, getJobStatuses, getLeadSources } from '../lib/job_nimbus/api';
import type { JnActivity, JobBaseData, JobStatusRegistry, JobLeadSourceRegistry } from '../lib/job_nimbus/domain';
import { jnCacheClear } from '../lib/job_nimbus/indexed_db';

interface JobNimbusDataContextType {
	activitiesByJobJnid: Record<string, JnActivity[]>;
	jobsByJnid: Record<string, JobBaseData>;
	statuses: JobStatusRegistry;
	leadSources: JobLeadSourceRegistry;
	isLoading: boolean;
	refresh: (forceFetch: boolean) => Promise<void>;
}

const JobNimbusDataContext = createContext<JobNimbusDataContextType | undefined>(undefined);

export function JobNimbusDataProvider({ children }: { children: ReactNode }) {
	const [activitiesByJobJnid, setActivitiesByJobJnid] = useState<Record<string, JnActivity[]>>({});
	const [jobsByJnid, setJobsByJnid] = useState<Record<string, JobBaseData>>({});
	const [statuses, setStatuses] = useState<JobStatusRegistry>({});
	const [leadSources, setLeadSources] = useState<JobLeadSourceRegistry>({});
	const [isLoading, setIsLoading] = useState(false);

	const refresh = async (allowFetch: boolean) => {
		setIsLoading(true);

		if (allowFetch) {
			await jnCacheClear();
		}

		setStatuses({});
		setLeadSources({});
		setJobsByJnid({});
		setActivitiesByJobJnid({});

		const statuses = await getJobStatuses(allowFetch);
		setStatuses(statuses);

		const leadSources = await getLeadSources(allowFetch);
		setLeadSources(leadSources);

		const jobs = await getAllJobBaseData(allowFetch);
		const jobsByJnidMap = jobs.reduce((acc, job) => {
			acc[job.jnid] = job;
			return acc;
		}, {} as Record<string, JobBaseData>);
		setJobsByJnid(jobsByJnidMap);

		const activities = await getAllJobActivities(allowFetch);
		const activitiesByJnid = activities.reduce((acc, activity) => {
			const jnid = activity.primaryJnid;
			if (!acc[jnid]) {
				acc[jnid] = [];
			}
			acc[jnid].push(activity);
			return acc;
		}, {} as Record<string, JnActivity[]>);
		setActivitiesByJobJnid(activitiesByJnid);

		setIsLoading(false);
	};

	const value: JobNimbusDataContextType = {
		activitiesByJobJnid,
		jobsByJnid,
		statuses,
		leadSources,
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
