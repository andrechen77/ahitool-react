import { useMemo, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import Plot from 'react-plotly.js';
import Select, { type MultiValue } from 'react-select';
import type { JobBaseData, JnActivity, JobStatusRegistry, JobLeadSourceRegistry } from '../lib/job_nimbus/domain';
import { generateKpiGraph, type KpiSankeyData } from '../lib/job_nimbus/kpi';
import JnClient from '../components/JnClient';
import { StatusGroupsModal } from '../components/StatusGroupsModal';
import {
	buildStatusNameToGroupMap,
	formatJobStatusWithGroup,
	statusGroupsToRecord,
	type StatusGroup,
} from '../components/StatusGroups';
import { useJobNimbusData, type JobNimbusMetadata } from '../contexts/JobNimbusDataContext';
import { useApiKey } from '../contexts/ApiKeyModalContext';
import { useSavedState } from '../hooks/useSavedState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ApiKeyError, getFilteredJobs, getActivitiesForJobs, getStatusesAndLeadSources, type JobFiltersForApi } from '../lib/job_nimbus/api';

const selectMenuStyles = {
	menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
};

const FILTERED_JOBS_PAGE_SIZE = 10;
const JOB_NIMBUS_JOB_URL = 'https://app.jobnimbus.com/job';

function jobNimbusJobUrl(jnid: string) {
	return `${JOB_NIMBUS_JOB_URL}/${jnid}`;
}

function SalesKpisPage() {
	const { metadata } = useJobNimbusData();

	return (
		<section className="w-full">
			<h1 className="mb-2">Sales KPIs</h1>
			<JnClient />
			{metadata ? (
				<SalesKpisContent metadata={metadata} />
			) : (
				<p className="mt-6 text-sm text-slate-500">
					Enter your API key and load JobNimbus data to view the diagram and settings.
				</p>
			)}
		</section>
	);
}

function SalesKpisContent({ metadata }: { metadata: JobNimbusMetadata }) {
	const { statuses, leadSources, salesReps } = metadata;
	const { apiKey } = useApiKey();

	const [statusGroupsModalOpen, setStatusGroupsModalOpen] = useState(false);
	const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
	const [filteredJobs, setFilteredJobs] = useState<JobBaseData[]>([]);
	const [filteredJobsPage, setFilteredJobsPage] = useState(0);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [isLoadingResults, setIsLoadingResults] = useState(false);
	const [loadingStatus, setLoadingStatus] = useState('');
	const [sankeyData, setSankeyData] = useState<KpiSankeyData>({
		nodeNames: [],
		jobsOnNode: [],
		sourceIds: [],
		targetIds: [],
		jobsOnLink: [],
		averageDurationMs: [],
	});
	const plotlyInputData = useMemo(() => {
		return [{
			type: 'sankey' as const,
			name: 'Job Milestone Flow',
			orientation: 'h' as const,
			node: {
				pad: 15,
				thickness: 20,
				line: { color: '#000', width: 0.5 },
				hovertemplate: "%{label}<br>Jobs reached this status: %{value}<br>Jobs currently at this status: %{customdata}",
				label: sankeyData.nodeNames,
				customdata: sankeyData.jobsOnNode.map(l => l.length),
			},
			link: {
				source: sankeyData.sourceIds,
				target: sankeyData.targetIds,
				value: sankeyData.jobsOnLink.map(jobs => jobs.length),
				hovertemplate: "%{source.label} -> %{target.label}<br>Number of jobs: %{value}<br>Average duration: %{customdata:.0f} days",
				customdata: sankeyData.averageDurationMs.map(d => d / 86400000),
			},
		}];
	}, [sankeyData]);
	const [minJobsPerFlow, setMinJobsPerFlow] = useSavedState<string>("sales-kpis:min_jobs_per_flow", String, String, () => "");

	const salesRepOptions = useMemo<SalesRepOption[]>(() => {
		return salesReps.filter(salesRep => salesRep !== "").map(salesRep => ({ value: salesRep, label: salesRep }));
	}, [salesReps]);
	const leadSourceOptions = useMemo<LeadSourceOption[]>(() => {
		return Object.values(leadSources).map(leadSource => ({ value: leadSource.name, label: leadSource.name }));
	}, [leadSources]);

	const [earliestCreatedDate, setEarliestCreatedDate] = useSavedState<string>(
		"sales-kpis:filter_earliest_created_date",
		String,
		String,
		() => "",
	);
	const [latestCreatedDate, setLatestCreatedDate] = useSavedState<string>(
		"sales-kpis:filter_latest_created_date",
		String,
		String,
		() => "",
	);
	const [selectedSalesReps, setSelectedSalesReps] = useSavedState<string[]>(
		"sales-kpis:filter_sales_reps",
		JSON.stringify,
		(str) => JSON.parse(str) as string[],
		() => [],
	);
	const [selectedLeadSources, setSelectedLeadSources] = useSavedState<string[]>(
		"sales-kpis:filter_lead_sources",
		JSON.stringify,
		(str) => JSON.parse(str) as string[],
		() => [],
	);

	const [plotlyLayout] = useState({
		autosize: true,
	});

	const handleGetResults = async () => {
		setIsLoadingResults(true);
		setLoadingStatus('Refreshing settings...');

		try {
			let currentStatuses: JobStatusRegistry = statuses;
			let currentLeadSources: JobLeadSourceRegistry = leadSources;

			try {
				const fresh = await getStatusesAndLeadSources(apiKey);
				if (fresh !== null) {
					currentStatuses = fresh.statuses;
					currentLeadSources = fresh.leadSources;
				}
			} catch (error) {
				if (error instanceof ApiKeyError) throw error;
				console.warn('Failed to refresh settings, using previously loaded values:', error);
			}
			void currentLeadSources;

			setLoadingStatus('Fetching filtered jobs...');

			const apiFilters: JobFiltersForApi = {
				earliestCreatedDate: earliestCreatedDate ? dateInputToLocalDate(earliestCreatedDate) : null,
				latestCreatedDate: latestCreatedDate ? dateInputToLocalDate(latestCreatedDate) : null,
				salesReps: selectedSalesReps,
				leadSources: selectedLeadSources,
			};

			const jobs = await getFilteredJobs(apiKey, apiFilters, currentStatuses);
			const jobsByJnid = jobs.reduce((acc, job) => {
				acc[job.jnid] = job;
				return acc;
			}, {} as Record<string, JobBaseData>);

			setFilteredJobs(jobs);
			setFilteredJobsPage(0);
			setHasGenerated(true);

			setLoadingStatus(`Fetching activities for ${jobs.length} jobs...`);

			const jobJnids = jobs.map(job => job.jnid);
			const activitiesByJobJnid: Record<string, JnActivity[]> = {};
			let activityCount = 0;
			let lastStatusUpdate = Date.now();

			for await (const activity of getActivitiesForJobs(apiKey, jobJnids, currentStatuses)) {
				const jnid = activity.primaryJnid;
				if (!activitiesByJobJnid[jnid]) {
					activitiesByJobJnid[jnid] = [];
				}
				activitiesByJobJnid[jnid].push(activity);
				activityCount++;

				if (Date.now() - lastStatusUpdate > 500) {
					lastStatusUpdate = Date.now();
					setLoadingStatus(`Fetching activities... (${activityCount} so far)`);
				}
			}

			setLoadingStatus('Processing results...');

			const statusGroupsObj = statusGroupsToRecord(statusGroups);
			const { data, invisibleJobs } = await generateKpiGraph(statusGroupsObj, activitiesByJobJnid, jobsByJnid);

			const minJobsPerFlowVal = Number(minJobsPerFlow);
			for (let i = 0; i < data.jobsOnLink.length; i++) {
				if (data.jobsOnLink[i].length < minJobsPerFlowVal) {
					invisibleJobs.push(...data.jobsOnLink[i]);

					data.jobsOnLink.splice(i, 1);
					data.sourceIds.splice(i, 1);
					data.targetIds.splice(i, 1);
					data.averageDurationMs.splice(i, 1);

					i--;
				}
			}

			console.log(`${invisibleJobs.length} jobs are not visible in the graph`, invisibleJobs);
			setSankeyData(data);
		} finally {
			setIsLoadingResults(false);
			setLoadingStatus('');
		}
	};

	return (
		<>
			<div className="mt-6 grid min-h-128 grid-cols-1 gap-6 lg:grid-cols-[30%_1fr]">
				<aside className="min-w-0">
					<Card>
						<h2 className="mb-4">Search settings</h2>

						<div className="space-y-6">
							<div>
								<h3 className="mb-2 text-sm font-semibold text-slate-800">Status groups</h3>
								<Button
									type="button"
									variant="secondary"
									size="md"
									onClick={() => setStatusGroupsModalOpen(true)}
								>
									Edit status groups
								</Button>
							</div>

							<div>
								<h3 className="mb-3 text-sm font-semibold text-slate-800">Filter jobs</h3>
								<div className="space-y-4">
									<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Earliest job creation date
										</label>
										<Input
											type="date"
											size="sm"
											value={earliestCreatedDate}
											onChange={(e) => setEarliestCreatedDate(e.target.value)}
										/>
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Latest job creation date
										</label>
										<Input
											type="date"
											size="sm"
											value={latestCreatedDate}
											onChange={(e) => setLatestCreatedDate(e.target.value)}
										/>
									</div>
										<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Filter by sales rep
										</label>
										<Select
											isMulti
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={salesRepOptions}
											value={selectedSalesReps.map(
												(name) =>
													salesRepOptions.find((option) => option.value === name) ?? {
														value: name,
														label: `Unknown rep ${name}`,
													},
											)}
											onChange={(selected: MultiValue<SalesRepOption>) => {
												setSelectedSalesReps(selected.map((option) => option.value));
											}}
											placeholder="Select sales reps (empty for all)"
										/>
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Filter by lead source
										</label>
										<Select
											isMulti
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={leadSourceOptions}
											value={selectedLeadSources.map(
												(name) =>
													leadSourceOptions.find((option) => option.value === name) ?? {
														value: name,
														label: `Unknown lead source ${name}`,
													},
											)}
											onChange={(selected: MultiValue<LeadSourceOption>) => {
												setSelectedLeadSources(selected.map((option) => option.value));
											}}
											placeholder="Select lead sources (empty for all)"
										/>
									</div>
								</div>
							</div>

							<div>
								<h3 className="mb-3 text-sm font-semibold text-slate-800">Graph settings</h3>
								<div>
									<label className="mb-1 block text-xs font-medium text-slate-600">
										Hide flows with fewer than <i>N</i> jobs
									</label>
									<Input
										type="number"
										size="sm"
										value={minJobsPerFlow}
										onChange={(e) => setMinJobsPerFlow(e.target.value)}
										placeholder="Enter a number"
									/>
								</div>
							</div>

							<Button onClick={handleGetResults} size="md" disabled={isLoadingResults}>
								{isLoadingResults ? loadingStatus || 'Loading...' : 'Get Results'}
							</Button>
						</div>
					</Card>
				</aside>

				<div className="flex min-h-64 min-w-0 flex-col gap-4 lg:min-h-0">
					<Card>
						<FilteredJobsTable
							jobs={filteredJobs}
							statusGroups={statusGroups}
							page={filteredJobsPage}
							onPageChange={setFilteredJobsPage}
							hasGenerated={hasGenerated}
						/>
					</Card>
					<Card className="flex-1">
						<h2 className="mb-2">Sankey Diagram</h2>
						<Plot
							data={plotlyInputData}
							layout={plotlyLayout}
							useResizeHandler
							style={{ width: '100%' }}
						/>
					</Card>
				</div>
			</div>

			<StatusGroupsModal
				isOpen={statusGroupsModalOpen}
				onClose={() => setStatusGroupsModalOpen(false)}
				statuses={statuses}
				storageKey="sales-kpis:status_groups"
				onStatusGroupsChange={setStatusGroups}
			/>
		</>
	);
}

interface SalesRepOption {
	value: string;
	label: string;
}

interface LeadSourceOption {
	value: string;
	label: string;
}

interface FilteredJobsTableProps {
	jobs: JobBaseData[];
	statusGroups: StatusGroup[];
	page: number;
	onPageChange: (page: number) => void;
	hasGenerated: boolean;
}

function FilteredJobsTable({
	jobs,
	statusGroups,
	page,
	onPageChange,
	hasGenerated,
}: FilteredJobsTableProps) {
	const statusNameToGroup = useMemo(
		() => buildStatusNameToGroupMap(statusGroups),
		[statusGroups],
	);
	const totalPages = Math.max(1, Math.ceil(jobs.length / FILTERED_JOBS_PAGE_SIZE));
	const safePage = Math.min(page, totalPages - 1);
	const pageStart = safePage * FILTERED_JOBS_PAGE_SIZE;
	const pageJobs = jobs.slice(pageStart, pageStart + FILTERED_JOBS_PAGE_SIZE);

	if (!hasGenerated) {
		return (
			<>
				<h2 className="mb-2">Filtered jobs</h2>
				<p className="text-sm text-slate-500">
					Click &quot;Get Results&quot; to fetch jobs matching the current filters.
				</p>
			</>
		);
	}

	return (
		<>
			<h2 className="mb-1">Filtered jobs</h2>
			<p className="mb-3 text-sm text-slate-600">
				Total: {jobs.length} job{jobs.length === 1 ? '' : 's'}
			</p>

			{jobs.length === 0 ? (
				<p className="text-sm text-slate-500">No jobs match the current filters.</p>
			) : (
				<>
					<div className="overflow-x-auto">
						<table className="table w-full table-fixed text-sm">
							<thead>
								<tr className="table-header-row">
									<th className="table-header-cell w-[30%] whitespace-nowrap">Name</th>
									<th className="table-header-cell w-[18%] whitespace-nowrap">Created date</th>
									<th className="table-header-cell w-[30%] whitespace-nowrap">Status</th>
									<th className="table-header-cell w-[14%] whitespace-nowrap">Job no.</th>
									<th className="table-header-cell w-[8%]"></th>
								</tr>
							</thead>
							<tbody>
								{pageJobs.map((job) => {
									const href = jobNimbusJobUrl(job.jnid);
									const name = job.jobName ?? '—';
									const createdDate = formatJobDate(job.createdDate);
									const status = formatJobStatusWithGroup(
										job.status.name,
										statusNameToGroup,
									);
									const jobNumber = job.jobNumber ?? '—';
									return (
										<tr
											key={job.jnid}
											className="table-row cursor-pointer hover:bg-slate-50"
											tabIndex={0}
											onClick={() => {}}
										>
											<TruncatedTableCell title={name}>{name}</TruncatedTableCell>
											<TruncatedTableCell title={createdDate}>
												{createdDate}
											</TruncatedTableCell>
											<TruncatedTableCell title={status}>{status}</TruncatedTableCell>
											<TruncatedTableCell title={jobNumber}>
												{jobNumber}
											</TruncatedTableCell>
											<td className="table-cell text-center">
												<a
													href={href}
													target="_blank"
													rel="noopener noreferrer"
													title="Open in JobNimbus"
													onClick={(e) => e.stopPropagation()}
													className="inline-flex items-center text-slate-400 hover:text-slate-700"
												>
													<FaExternalLinkAlt size={12} />
												</a>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{totalPages > 1 && (
						<div className="mt-3 flex items-center justify-between gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => onPageChange(Math.max(0, safePage - 1))}
								disabled={safePage === 0}
							>
								Previous
							</Button>
							<span className="text-sm text-slate-600">
								Page {safePage + 1} of {totalPages}
							</span>
							<Button
								type="button"
								variant="secondary"
								size="sm"
								onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
								disabled={safePage >= totalPages - 1}
							>
								Next
							</Button>
						</div>
					)}
				</>
			)}
		</>
	);
}

function TruncatedTableCell({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<td className="table-cell max-w-0 truncate whitespace-nowrap" title={title}>
			{children}
		</td>
	);
}

function formatJobDate(date: Date) {
	const localString = date.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZoneName: 'short',
	});
	return localString;
}

function dateInputToLocalDate(value: string) {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export default SalesKpisPage;
