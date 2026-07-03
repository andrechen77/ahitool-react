import { useMemo, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import Plot from 'react-plotly.js';
import Select, { type MultiValue } from 'react-select';
import type { JobBaseData, JnActivity, JobStatusRegistry, JobLeadSourceRegistry, JobLocationRegistry } from '../lib/job_nimbus/domain';
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
	const { statuses, leadSources, locations, salesReps } = metadata;
	const { apiKey } = useApiKey();

	const [statusGroupsModalOpen, setStatusGroupsModalOpen] = useState(false);
	const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
	const [filteredJobs, setFilteredJobs] = useState<JobBaseData[]>([]);
	const [filteredJobsPage, setFilteredJobsPage] = useState(0);
	const [activitiesByJobJnid, setActivitiesByJobJnid] = useState<Record<string, JnActivity[]>>({});
	const [selectedJobJnid, setSelectedJobJnid] = useState<string | null>(null);
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
		return Object.values(leadSources).map(leadSource => ({ value: leadSource.id, label: leadSource.name }));
	}, [leadSources]);
	const statusOptions = useMemo<StatusOption[]>(() => {
		return Object.values(statuses).map(status => ({ value: status.id, label: status.name }));
	}, [statuses]);
	const locationOptions = useMemo<LocationOption[]>(() => {
		return Object.values(locations).map(loc => ({ value: loc.id, label: loc.name }));
	}, [locations]);

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
	const [selectedLeadSources, setSelectedLeadSources] = useSavedState<number[]>(
		"sales-kpis:filter_lead_source_ids",
		JSON.stringify,
		(str) => JSON.parse(str) as number[],
		() => [],
	);
	const [leadSourceFilterMode, setLeadSourceFilterMode] = useSavedState<FilterByMode>(
		"sales-kpis:filter_lead_source_mode",
		String,
		(str) => str as FilterByMode,
		() => "name",
	);
	const [selectedStatuses, setSelectedStatuses] = useSavedState<number[]>(
		"sales-kpis:filter_status_ids",
		JSON.stringify,
		(str) => JSON.parse(str) as number[],
		() => [],
	);
	const [statusFilterMode, setStatusFilterMode] = useSavedState<FilterByMode>(
		"sales-kpis:filter_status_mode",
		String,
		(str) => str as FilterByMode,
		() => "name",
	);
	const [selectedLocations, setSelectedLocations] = useSavedState<number[]>(
		"sales-kpis:filter_location_ids",
		JSON.stringify,
		(str) => JSON.parse(str) as number[],
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
			let currentLocations: JobLocationRegistry = locations;

			try {
				const fresh = await getStatusesAndLeadSources(apiKey);
				if (fresh !== null) {
					currentStatuses = fresh.statuses;
					currentLeadSources = fresh.leadSources;
					currentLocations = fresh.locations;
				}
			} catch (error) {
				if (error instanceof ApiKeyError) throw error;
				console.warn('Failed to refresh settings, using previously loaded values:', error);
			}
			setLoadingStatus('Fetching filtered jobs...');

			const leadSourceNames: string[] = leadSourceFilterMode === 'name'
				? Array.from(new Set(selectedLeadSources.map(id => currentLeadSources[id]?.name).filter((n): n is string => n != null)))
				: [];
			const leadSourceIds: number[] = leadSourceFilterMode === 'id'
				? selectedLeadSources
				: [];
			const statusNames: string[] = statusFilterMode === 'name'
				? Array.from(new Set(selectedStatuses.map(id => currentStatuses[id]?.name).filter((n): n is string => n != null)))
				: [];
			const statusIds: number[] = statusFilterMode === 'id'
				? selectedStatuses
				: [];

			const apiFilters: JobFiltersForApi = {
				earliestCreatedDate: earliestCreatedDate ? dateInputToLocalDate(earliestCreatedDate) : null,
				latestCreatedDate: latestCreatedDate ? dateInputToLocalDate(latestCreatedDate) : null,
				salesReps: selectedSalesReps,
				leadSourceNames,
				leadSourceIds,
				statusNames,
				statusIds,
				locationIds: selectedLocations,
			};

			const jobs = await getFilteredJobs(apiKey, apiFilters, currentStatuses, currentLeadSources, currentLocations);
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

			setActivitiesByJobJnid(activitiesByJobJnid);
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
								<h3 className="mb-2 text-base font-bold text-slate-800">Status groups</h3>
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
								<h3 className="mb-3 text-base font-bold text-slate-800">Filter jobs</h3>
								<div className="space-y-4">
									<div>
										<label className="mb-1 block text-sm font-semibold text-slate-700">
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
										<label className="mb-1 block text-sm font-semibold text-slate-700">
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
										<label className="mb-1 block text-sm font-semibold text-slate-700">
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
										<label className="mb-1 block text-sm font-semibold text-slate-700">
											Filter by lead source
										</label>
										<div
											className="mb-2 flex items-center gap-3 text-xs text-slate-600"
											title="Lead sources have a display name, but are internally identified by a numeric ID in the JobNimbus database. Job records use both the ID and the name to refer to the associated lead source. If JobNimbus improperly updates the database, it can cause the job to be associated with two lead sources at once: one via the ID and another via the display name. Therefore, doing a search by ID vs name can sometimes give different results."
										>
											<span>Filter by:</span>
											<label className="flex items-center gap-1">
												<input
													type="radio"
													name="leadSourceFilterMode"
													checked={leadSourceFilterMode === 'name'}
													onChange={() => setLeadSourceFilterMode('name')}
												/>
												Name
											</label>
											<label className="flex items-center gap-1">
												<input
													type="radio"
													name="leadSourceFilterMode"
													checked={leadSourceFilterMode === 'id'}
													onChange={() => setLeadSourceFilterMode('id')}
												/>
												ID
											</label>
										</div>
										<Select
											isMulti
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={leadSourceOptions}
											value={selectedLeadSources.map(
												(id) =>
													leadSourceOptions.find((option) => option.value === id) ?? {
														value: id,
														label: `Unknown lead source with id ${id}`,
													},
											)}
											onChange={(selected: MultiValue<LeadSourceOption>) => {
												setSelectedLeadSources(selected.map((option) => option.value));
											}}
											placeholder="Select lead sources (empty for all)"
										/>
									</div>
									<div>
										<label className="mb-1 block text-sm font-semibold text-slate-700">
											Filter by status
										</label>
										<div
											className="mb-2 flex items-center gap-3 text-xs text-slate-600"
											title="Statuses have a display name, but are internally identified by a numeric ID in the JobNimbus database. Job records use both the ID and the name to refer to the associated status. If JobNimbus improperly updates the database, it can cause the job to be associated with two statuses at once: one via the ID and another via the display name. Therefore, doing a search by ID vs name can sometimes give different results."
										>
											<span>Filter by:</span>
											<label className="flex items-center gap-1">
												<input
													type="radio"
													name="statusFilterMode"
													checked={statusFilterMode === 'name'}
													onChange={() => setStatusFilterMode('name')}
												/>
												Name
											</label>
											<label className="flex items-center gap-1">
												<input
													type="radio"
													name="statusFilterMode"
													checked={statusFilterMode === 'id'}
													onChange={() => setStatusFilterMode('id')}
												/>
												ID
											</label>
										</div>
										<Select
											isMulti
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={statusOptions}
											value={selectedStatuses.map(
												(id) =>
													statusOptions.find((option) => option.value === id) ?? {
														value: id,
														label: `Unknown (${id})`,
													},
											)}
											onChange={(selected: MultiValue<StatusOption>) => {
												setSelectedStatuses(selected.map((option) => option.value));
											}}
											placeholder="Select statuses (empty for all)"
										/>
									</div>

									<div>
										<label className="mb-1 block text-sm font-semibold text-slate-700">
											Location
										</label>
										<Select
											isMulti
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={locationOptions}
											value={selectedLocations.map(
												(id) =>
													locationOptions.find((option) => option.value === id) ?? {
														value: id,
														label: `Unknown (${id})`,
													},
											)}
											onChange={(selected: MultiValue<LocationOption>) => {
												setSelectedLocations(selected.map((option) => option.value));
											}}
											placeholder="Select locations (empty for all)"
										/>
									</div>
								</div>
							</div>

							<div>
								<h3 className="mb-3 text-base font-bold text-slate-800">Graph settings</h3>
								<div>
									<label className="mb-1 block text-sm font-semibold text-slate-700">
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
							onJobClick={setSelectedJobJnid}
						/>
					</Card>
					{selectedJobJnid && (
						<Card>
							<JobInfoPanel
								jnid={selectedJobJnid}
								job={filteredJobs.find(j => j.jnid === selectedJobJnid) ?? null}
								activities={activitiesByJobJnid[selectedJobJnid] ?? []}
								onClose={() => setSelectedJobJnid(null)}
							/>
						</Card>
					)}
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
	value: number;
	label: string;
}

interface StatusOption {
	value: number;
	label: string;
}

interface LocationOption {
	value: number;
	label: string;
}

type FilterByMode = 'name' | 'id';

interface FilteredJobsTableProps {
	jobs: JobBaseData[];
	statusGroups: StatusGroup[];
	page: number;
	onPageChange: (page: number) => void;
	hasGenerated: boolean;
	onJobClick: (jnid: string) => void;
}

function FilteredJobsTable({
	jobs,
	statusGroups,
	page,
	onPageChange,
	hasGenerated,
	onJobClick,
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
										job.status?.name ?? "—",
										statusNameToGroup,
									);
									const jobNumber = job.jobNumber ?? '—';
									return (
										<tr
											key={job.jnid}
											className="table-row cursor-pointer hover:bg-slate-50"
											tabIndex={0}
											onClick={() => onJobClick(job.jnid)}
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

function formatCents(cents: number): string {
	return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface JobInfoPanelProps {
	jnid: string;
	job: JobBaseData | null;
	activities: JnActivity[];
	onClose: () => void;
}

function JobInfoPanel({ jnid, job, activities, onClose }: JobInfoPanelProps) {
	const sortedActivities = useMemo(
		() => [...activities].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
		[activities],
	);

	return (
		<div>
			<div className="flex items-center justify-between mb-4">
				<h2>Info for job {jnid}</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					Close
				</Button>
			</div>

			{job === null ? (
				<p className="text-sm text-slate-500">Job not found in filtered results.</p>
			) : (
				<>
					<div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 mb-6">
						<div>
							<span className="font-semibold text-slate-700">Name:</span>{' '}
							{job.jobName ?? '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Job number:</span>{' '}
							{job.jobNumber ?? '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Status:</span>{' '}
							{job.status?.name ?? "—"}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Status last changed:</span>{' '}
							{job.statusModDate ? formatJobDate(job.statusModDate) : '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Created:</span>{' '}
							{formatJobDate(job.createdDate)}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Location:</span>{' '}
							{job.location ? `${job.location.name} (ID: ${job.location.id})` : '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Sales rep:</span>{' '}
							{job.salesRep ?? '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Lead source:</span>{' '}
							{job.leadSource ? `${job.leadSource.name} (ID: ${job.leadSource.id})` : '—'}
						</div>
						{job.leadSourceNameMismatch && (
							<div>
								<span className="font-semibold text-amber-700">Lead source name mismatch:</span>{' '}
								<span className="text-amber-600">
									Raw name is &quot;{job.leadSourceNameMismatch}&quot; but registry says &quot;{job.leadSource?.name}&quot;
								</span>
							</div>
						)}
						<div>
							<span className="font-semibold text-slate-700">Amount receivable:</span>{' '}
							{job.amtReceivable > 0 ? formatCents(job.amtReceivable) : '—'}
						</div>
						<div>
							<span className="font-semibold text-slate-700">Insurance:</span>{' '}
							{job.insuranceCheckbox ? 'Yes' : 'No'}
							{job.insuranceCompanyName && ` (${job.insuranceCompanyName})`}
						</div>
						{job.insuranceClaimNumber && (
							<div>
								<span className="font-semibold text-slate-700">Claim #:</span>{' '}
								{job.insuranceClaimNumber}
							</div>
						)}
					</div>

					<h3 className="text-base font-bold text-slate-800 mb-2">Milestone dates</h3>
					<div className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2 mb-6">
						{Object.entries(job.milestoneDates).map(([milestone, date]) => (
							<div key={milestone}>
								<span className="font-medium text-slate-600">{milestone}:</span>{' '}
								{date ? formatJobDate(date) : '—'}
							</div>
						))}
					</div>

					<h3 className="text-base font-bold text-slate-800 mb-2">
						Activities ({sortedActivities.length})
					</h3>
					{sortedActivities.length === 0 ? (
						<p className="text-sm text-slate-500">No activities found for this job.</p>
					) : (
						<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
							<table className="table w-full text-sm">
								<thead className="table-header-sticky">
									<tr className="table-header-row">
										<th className="table-header-cell whitespace-nowrap">Date</th>
										<th className="table-header-cell whitespace-nowrap">Type</th>
										<th className="table-header-cell whitespace-nowrap">Details</th>
									</tr>
								</thead>
								<tbody>
									{sortedActivities.map((activity, index) => (
										<tr key={index} className="table-row">
											<td className="table-cell whitespace-nowrap">
												{formatJobDate(activity.timestamp)}
											</td>
											<td className="table-cell whitespace-nowrap">
												{activityTypeLabel(activity)}
											</td>
											<td className="table-cell">
												{activityDetails(activity)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</>
			)}
		</div>
	);
}

function activityTypeLabel(activity: JnActivity): string {
	switch (activity.type) {
		case 'job_created': return 'Job Created';
		case 'status_changed': return 'Status Changed';
		case 'job_modified': return 'Job Modified';
		case 'generic': return activity.recordTypeName;
	}
}

function activityDetails(activity: JnActivity): React.ReactNode {
	switch (activity.type) {
		case 'job_created':
			return <span className="text-slate-500">Job was created</span>;
		case 'status_changed':
			return (
				<span>
					<span className="text-slate-500">{activity.oldStatusName}</span>
					{' → '}
					<span className="font-medium">{activity.newStatusName}</span>
				</span>
			);
		case 'job_modified': {
			const entries = Object.entries(activity.updates);
			if (entries.length === 0) return <span className="text-slate-500">{activity.note || '—'}</span>;
			return (
				<span>
					{entries.map(([field, [oldVal, newVal]], i) => (
						<span key={field}>
							{i > 0 && '; '}
							<span className="font-medium">{field}</span>: {oldVal || '(empty)'} → {newVal || '(empty)'}
						</span>
					))}
				</span>
			);
		}
		case 'generic':
			return <span className="text-slate-500">{activity.note || '—'}</span>;
	}
}

export default SalesKpisPage;
