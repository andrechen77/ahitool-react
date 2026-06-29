import { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import Select, { type MultiValue, type SingleValue } from 'react-select';
import type { JobBaseData } from '../lib/job_nimbus/domain';
import { generateKpiGraph, type KpiSankeyData } from '../lib/job_nimbus/kpi';
import JnClient from '../components/JnClient';
import { StatusGroupsModal } from '../components/StatusGroupsModal';
import {
	buildStatusNameToGroupMap,
	formatJobStatusWithGroup,
	statusGroupsToRecord,
	type StatusGroup,
} from '../components/StatusGroups';
import { useJobNimbusData, type JobNimbusData } from '../contexts/JobNimbusDataContext';
import { useSavedState } from '../hooks/useSavedState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

const selectMenuStyles = {
	menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
};

const SELECTED_JOBS_PAGE_SIZE = 10;
const JOB_NIMBUS_JOB_URL = 'https://app.jobnimbus.com/job';

function jobNimbusJobUrl(jnid: string) {
	return `${JOB_NIMBUS_JOB_URL}/${jnid}`;
}

function SalesKpisPage() {
	const { data: jnData } = useJobNimbusData();

	return (
		<section className="w-full">
			<h1 className="mb-2">Sales KPIs</h1>
			<JnClient />
			{jnData ? (
				<SalesKpisContent jnData={jnData} />
			) : (
				<p className="mt-6 text-sm text-slate-500">
					Enter your API key and load JobNimbus data to view the diagram and settings.
				</p>
			)}
		</section>
	);
}

function SalesKpisContent({ jnData }: { jnData: JobNimbusData }) {
	const { statuses, leadSources, activitiesByJobJnid, jobsByJnid, states, salesReps } = jnData;

	const [statusGroupsModalOpen, setStatusGroupsModalOpen] = useState(false);
	const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
	const [selectedJobs, setSelectedJobs] = useState<JobBaseData[]>([]);
	const [selectedJobsPage, setSelectedJobsPage] = useState(0);
	const [hasGenerated, setHasGenerated] = useState(false);
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

	const stateOptions = useMemo<BranchOption[]>(() => {
		return [
			{ value: '', label: 'All states' },
			...states.filter(state => state !== "").map(state => ({ value: state, label: state })),
		];
	}, [states]);
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
	const [selectedBranch, setSelectedBranch] = useSavedState<string>(
		"sales-kpis:filter_branch",
		String,
		String,
		() => stateOptions[0].value,
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
	// const [minJobSize, setMinJobSize] = useSavedState<string>(
	// 	"sales-kpis:filter_min_job_size",
	// 	String,
	// 	String,
	// 	() => "",
	// );
	// const [maxJobSize, setMaxJobSize] = useSavedState<string>(
	// 	"sales-kpis:filter_max_job_size",
	// 	String,
	// 	String,
	// 	() => "",
	// );

	const [plotlyLayout] = useState({
		autosize: true,
	});
	const jobFilters = useMemo<JobFilters>(
		() => ({
			earliestCreatedDate: earliestCreatedDate
				? dateInputToLocalDate(earliestCreatedDate)
				: null,
			latestCreatedDate: latestCreatedDate
				? dateInputToLocalDate(latestCreatedDate)
				: null,
			selectedBranch,
			selectedSalesReps,
			selectedLeadSources,
		}),
		[
			earliestCreatedDate,
			latestCreatedDate,
			selectedBranch,
			selectedSalesReps,
			selectedLeadSources,
		],
	);

	const calculateSankeyData = async () => {
		const statusGroupsObj = statusGroupsToRecord(statusGroups);

		const filteredJobs = filterJobs(jobsByJnid, jobFilters);
		const filteredJobsByJnid = Object.fromEntries(filteredJobs.map((job) => [job.jnid, job]));

		setSelectedJobs(filteredJobs);
		setSelectedJobsPage(0);
		setHasGenerated(true);

		const { data, invisibleJobs } = await generateKpiGraph(statusGroupsObj, activitiesByJobJnid, filteredJobsByJnid);

		// filter out links with fewer than minJobsPerFlow jobs
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
									{/*<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Minimum job size ($)
										</label>
										<Input
											type="number"
											size="sm"
											min={0}
											step={0.01}
											value={minJobSize}
											onChange={(e) => setMinJobSize(e.target.value)}
											placeholder="No minimum"
										/>
									</div>
									<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Maximum job size ($)
										</label>
										<Input
											type="number"
											size="sm"
											min={0}
											step={0.01}
											value={maxJobSize}
											onChange={(e) => setMaxJobSize(e.target.value)}
											placeholder="No maximum"
										/>
									</div>*/}
									<div>
										<label className="mb-1 block text-xs font-medium text-slate-600">
											Filter by state
										</label>
										<Select
											menuPortalTarget={document.body}
											menuPosition="fixed"
											styles={selectMenuStyles}
											options={stateOptions}
											value={
												stateOptions.find((option) => option.value === selectedBranch) ??
												null
											}
											onChange={(option: SingleValue<BranchOption>) => {
												setSelectedBranch(option?.value ?? "");
											}}
											classNamePrefix="branch-select"
											placeholder="Select a state"
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

							<Button onClick={calculateSankeyData} size="md">
								Generate Sankey Diagram
							</Button>
						</div>
					</Card>
				</aside>

				<div className="flex min-h-64 min-w-0 flex-col gap-4 lg:min-h-0">
					<Card>
						<SelectedJobsTable
							jobs={selectedJobs}
							statusGroups={statusGroups}
							page={selectedJobsPage}
							onPageChange={setSelectedJobsPage}
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

			<Card className="mt-6">
				<CheckJobFilterCard
					jobsByJnid={jobsByJnid}
					selectedJobs={selectedJobs}
					filters={jobFilters}
				/>
			</Card>

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

interface BranchOption {
	value: string;
	label: string;
}

interface SalesRepOption {
	value: string;
	label: string;
}

interface LeadSourceOption {
	value: string;
	label: string;
}

interface JobFilters {
	earliestCreatedDate: Date | null;
	latestCreatedDate: Date | null;
	selectedBranch: string;
	selectedSalesReps: string[];
	selectedLeadSources: string[];
}

interface JobFilterCriteriaResult {
	earliestCreatedDate: boolean;
	latestCreatedDate: boolean;
	branch: boolean;
	salesRep: boolean;
	leadSource: boolean;
}

interface JobFilterDecision {
	criteria: JobFilterCriteriaResult;
	included: boolean;
	explanations?: Record<keyof JobFilterCriteriaResult, string>;
}

function formatQuotedList(items: string[]): string {
	if (items.length === 0) {
		return '""';
	}
	const quoted = items.map((item) => `"${item}"`);
	if (items.length === 1) {
		return quoted[0];
	}
	if (items.length === 2) {
		return `${quoted[0]} and ${quoted[1]}`;
	}
	return `${quoted.slice(0, -1).join(', ')}, and ${quoted[quoted.length - 1]}`;
}

function evaluateJobFilter(
	job: JobBaseData,
	filters: JobFilters,
	generateExplanations = false,
): JobFilterDecision {
	const explanations: Partial<Record<keyof JobFilterCriteriaResult, string>> = {};

	let earliestCreatedDate;
	if (!filters.earliestCreatedDate) {
		earliestCreatedDate = true;
		if (generateExplanations) {
			explanations.earliestCreatedDate = 'no earliest created date filter was specified';
		}
	} else {
		earliestCreatedDate = job.createdDate >= filters.earliestCreatedDate;
		if (generateExplanations) {
			const jobDate = formatJobDate(job.createdDate);
			const filterDate = formatJobDate(filters.earliestCreatedDate);
			explanations.earliestCreatedDate = earliestCreatedDate
				? `job was created on ${jobDate}, on or after ${filterDate}`
				: `job was created on ${jobDate}, before ${filterDate}`;
		}
	}

	let latestCreatedDate;
	if (!filters.latestCreatedDate) {
		latestCreatedDate = true;
		if (generateExplanations) {
			explanations.latestCreatedDate = 'no latest created date filter was specified';
		}
	} else {
		latestCreatedDate = job.createdDate <= filters.latestCreatedDate;
		if (generateExplanations) {
			const jobDate = formatJobDate(job.createdDate);
			const filterDate = formatJobDate(filters.latestCreatedDate);
			explanations.latestCreatedDate = latestCreatedDate
				? `job was created on ${jobDate}, on or before ${filterDate}`
				: `job was created on ${jobDate}, after ${filterDate}`;
		}
	}

	let branch;
	if (filters.selectedBranch === '') {
		branch = true;
		if (generateExplanations) {
			explanations.branch = 'no branch/state filter was specified';
		}
	} else {
		branch = job.state === filters.selectedBranch;
		if (generateExplanations) {
			explanations.branch = branch
				? `"${job.state}" matches the selected state "${filters.selectedBranch}"`
				: `job state is "${job.state}", but the filter is set to "${filters.selectedBranch}"`;
		}
	}

	let salesRep;
	if (filters.selectedSalesReps.length === 0) {
		salesRep = true;
		if (generateExplanations) {
			explanations.salesRep = 'no sales rep filter was specified';
		}
	} else {
		salesRep =
			job.salesRep !== null && filters.selectedSalesReps.includes(job.salesRep);
		if (generateExplanations) {
			const selected = formatQuotedList(filters.selectedSalesReps);
			if (salesRep) {
				explanations.salesRep = `"${job.salesRep}" is included in ${selected}`;
			} else if (job.salesRep === null) {
				explanations.salesRep = `job has no sales rep assigned, but the filter requires one of ${selected}`;
			} else {
				explanations.salesRep = `"${job.salesRep}" is not among the selected sales reps (${selected})`;
			}
		}
	}

	let leadSource;
	if (filters.selectedLeadSources.length === 0) {
		leadSource = true;
		if (generateExplanations) {
			explanations.leadSource = 'no lead source filter was specified';
		}
	} else {
		leadSource =
			job.leadSourceName !== null &&
			filters.selectedLeadSources.includes(job.leadSourceName);
		if (generateExplanations) {
			const selected = formatQuotedList(filters.selectedLeadSources);
			if (leadSource) {
				explanations.leadSource = `"${job.leadSourceName}" is included in ${selected}`;
			} else if (job.leadSourceName === null) {
				explanations.leadSource = `job has no lead source, but the filter requires one of ${selected}`;
			} else {
				explanations.leadSource = `"${job.leadSourceName}" is not among the selected lead sources (${selected})`;
			}
		}
	}

	const criteria = {
		earliestCreatedDate,
		latestCreatedDate,
		branch,
		salesRep,
		leadSource,
	};

	const included =
		criteria.earliestCreatedDate &&
		criteria.latestCreatedDate &&
		criteria.branch &&
		criteria.salesRep &&
		criteria.leadSource;

	if (!generateExplanations) {
		return { criteria, included };
	}

	return {
		criteria,
		included,
		explanations: explanations as Record<keyof JobFilterCriteriaResult, string>,
	};
}

function filterJobs(
	jobsByJnid: Record<string, JobBaseData>,
	filters: JobFilters,
): JobBaseData[] {
	return Object.values(jobsByJnid)
		.filter((job) => evaluateJobFilter(job, filters).included)
		.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
}

type JobFilterCheckResult =
	| { jnid: string; jobFound: false }
	| {
		jnid: string;
		jobFound: true;
		inSelectedJobs: boolean;
		filterDecision: JobFilterDecision;
	};

const JOB_FILTER_CRITERIA_LABELS: Record<keyof JobFilterCriteriaResult, string> = {
	earliestCreatedDate: 'Earliest created date',
	latestCreatedDate: 'Latest created date',
	branch: 'Branch/state',
	salesRep: 'Sales rep',
	leadSource: 'Lead source',
};

function CheckJobFilterCard({
	jobsByJnid,
	selectedJobs,
	filters,
}: {
	jobsByJnid: Record<string, JobBaseData>;
	selectedJobs: JobBaseData[];
	filters: JobFilters;
}) {
	const [jnid, setJnid] = useState('');
	const [result, setResult] = useState<JobFilterCheckResult | null>(null);

	const handleCheck = () => {
		const trimmedJnid = jnid.trim();
		if (!trimmedJnid) {
			setResult(null);
			return;
		}

		if (!(trimmedJnid in jobsByJnid)) {
			setResult({ jnid: trimmedJnid, jobFound: false });
			return;
		}

		const job = jobsByJnid[trimmedJnid];
		const filterDecision = evaluateJobFilter(job, filters, true);

		setResult({
			jnid: trimmedJnid,
			jobFound: true,
			inSelectedJobs: selectedJobs.some((selectedJob) => selectedJob.jnid === trimmedJnid),
			filterDecision,
		});
	};

	return (
		<>
			<h2 className="mb-4">Check if job was filtered</h2>
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-64 flex-1">
					<label className="mb-1 block text-xs font-medium text-slate-600">Job JNID</label>
					<Input
						type="text"
						size="sm"
						value={jnid}
						onChange={(e) => setJnid(e.target.value)}
						placeholder="Enter a job JNID"
					/>
				</div>
				<Button type="button" size="md" onClick={handleCheck}>
					Check
				</Button>
			</div>

			{result && (
				<div className="mt-4 space-y-3 text-sm">
					{!result.jobFound ? (
						<p className="text-slate-500">
							No job with JNID &quot;{result.jnid}&quot; was found in the loaded data.
						</p>
					) : (
						<>
							<p>
								<span className="font-medium text-slate-800">In selected jobs:</span>{' '}
								{result.inSelectedJobs ? 'Yes' : 'No'}
							</p>
							<div className="space-y-2">
								<p>
									<span className="font-medium text-slate-800">Filter decision:</span>{' '}
									{result.filterDecision.included ? 'Included' : 'Excluded'}
								</p>
								<ul className="space-y-1">
									{(Object.keys(JOB_FILTER_CRITERIA_LABELS) as (keyof JobFilterCriteriaResult)[]).map(
										(key) => {
											const passed = result.filterDecision.criteria[key];
											return (
												<li key={key}>
													<span className="font-medium text-slate-800">
														{JOB_FILTER_CRITERIA_LABELS[key]}:
													</span>{' '}
													{passed ? 'Passed' : 'Failed'} (
													{result.filterDecision.explanations![key]})
												</li>
											);
										},
									)}
								</ul>
							</div>
						</>
					)}
				</div>
			)}
		</>
	);
}

interface SelectedJobsTableProps {
	jobs: JobBaseData[];
	statusGroups: StatusGroup[];
	page: number;
	onPageChange: (page: number) => void;
	hasGenerated: boolean;
}

function SelectedJobsTable({
	jobs,
	statusGroups,
	page,
	onPageChange,
	hasGenerated,
}: SelectedJobsTableProps) {
	const statusNameToGroup = useMemo(
		() => buildStatusNameToGroupMap(statusGroups),
		[statusGroups],
	);
	const totalPages = Math.max(1, Math.ceil(jobs.length / SELECTED_JOBS_PAGE_SIZE));
	const safePage = Math.min(page, totalPages - 1);
	const pageStart = safePage * SELECTED_JOBS_PAGE_SIZE;
	const pageJobs = jobs.slice(pageStart, pageStart + SELECTED_JOBS_PAGE_SIZE);

	if (!hasGenerated) {
		return (
			<>
				<h2 className="mb-2">Selected jobs</h2>
				<p className="text-sm text-slate-500">
					Click &quot;Generate Sankey Diagram&quot; to list jobs matching the current filters.
				</p>
			</>
		);
	}

	return (
		<>
			<h2 className="mb-1">Selected jobs</h2>
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
									<th className="table-header-cell w-[33%] whitespace-nowrap">Name</th>
									<th className="table-header-cell w-[18%] whitespace-nowrap">Created date</th>
									<th className="table-header-cell w-[34%] whitespace-nowrap">Status</th>
									<th className="table-header-cell w-[15%] whitespace-nowrap">Job no.</th>
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
											role="link"
											tabIndex={0}
											title="Open job in JobNimbus"
											onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													window.open(href, '_blank', 'noopener,noreferrer');
												}
											}}
										>
											<TruncatedTableCell title={name}>{name}</TruncatedTableCell>
											<TruncatedTableCell title={createdDate}>
												{createdDate}
											</TruncatedTableCell>
											<TruncatedTableCell title={status}>{status}</TruncatedTableCell>
											<TruncatedTableCell title={jobNumber}>
												{jobNumber}
											</TruncatedTableCell>
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
