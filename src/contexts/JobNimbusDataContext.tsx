import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiKeyError, getSalesReps, getStatusesAndLeadSources } from '../lib/job_nimbus/api';
import type { JobStatusRegistry, JobLeadSourceRegistry } from '../lib/job_nimbus/domain';

export interface JobNimbusMetadata {
	statuses: JobStatusRegistry;
	leadSources: JobLeadSourceRegistry;
	salesReps: string[];
}

interface JobNimbusDataContextType {
	metadata: JobNimbusMetadata | null;
	isLoadingMetadata: boolean;
	loadMetadata: (apiKey: string) => Promise<void>;
}

const JobNimbusDataContext = createContext<JobNimbusDataContextType | undefined>(undefined);

export function JobNimbusDataProvider({ children }: { children: ReactNode }) {
	const [metadata, setMetadata] = useState<JobNimbusMetadata | null>(null);
	const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

	const loadMetadata = async (apiKey: string) => {
		if (apiKey.length !== 16) {
			throw new ApiKeyError('Invalid API key', apiKey);
		}

		setIsLoadingMetadata(true);
		try {
			const [settingsResult, salesRepsResult] = await Promise.all([
				getStatusesAndLeadSources(apiKey),
				getSalesReps(apiKey),
			]);

			setMetadata(prev => ({
				statuses: settingsResult?.statuses ?? prev?.statuses ?? {},
				leadSources: settingsResult?.leadSources ?? prev?.leadSources ?? {},
				salesReps: salesRepsResult ?? prev?.salesReps ?? [],
			}));
		} finally {
			setIsLoadingMetadata(false);
		}
	};

	return (
		<JobNimbusDataContext.Provider value={{ metadata, isLoadingMetadata, loadMetadata }}>
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
