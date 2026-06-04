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
		sourceIds: [],
		targetIds: [],
		jobs: [],
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
				label: sankeyData.nodeNames,
			},
			link: {
				source: sankeyData.sourceIds,
				target: sankeyData.targetIds,
				value: sankeyData.jobs.map(jobs => jobs.length),
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
	const [minJobSize, setMinJobSize] = useSavedState<string>(
		"sales-kpis:filter_min_job_size",
		String,
		String,
		() => "",
	);
	const [maxJobSize, setMaxJobSize] = useSavedState<string>(
		"sales-kpis:filter_max_job_size",
		String,
		String,
		() => "",
	);

	const [plotlyLayout] = useState({
		autosize: true,
	});

	const calculateSankeyData = async () => {
		const statusGroupsObj = statusGroupsToRecord(statusGroups);

		const filteredJobs = filterJobs(jobsByJnid, {
			earliestCreatedDate,
			latestCreatedDate,
			selectedBranch,
			selectedSalesReps,
			selectedLeadSources,
		});
		const filteredJobsByJnid = Object.fromEntries(filteredJobs.map((job) => [job.jnid, job]));

		setSelectedJobs(filteredJobs);
		setSelectedJobsPage(0);
		setHasGenerated(true);

		const { data, invisibleJobs } = await generateKpiGraph(statusGroupsObj, activitiesByJobJnid, filteredJobsByJnid);

		const minJobsPerFlowVal = Number(minJobsPerFlow);
		for (let i = 0; i < data.jobs.length; i++) {
			if (data.jobs[i].length < minJobsPerFlowVal) {
				invisibleJobs.push(...data.jobs[i]);

				data.jobs.splice(i, 1);
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
			<div className="mt-6 grid min-h-128 grid-cols-1 gap-6 lg:grid-cols-2">
				<div className="flex min-h-64 flex-col gap-4 lg:min-h-0">
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

				<aside>
					<Card>
						<h2 className="mb-4">Settings</h2>

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
									</div>
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
	earliestCreatedDate: string;
	latestCreatedDate: string;
	selectedBranch: string;
	selectedSalesReps: string[];
	selectedLeadSources: string[];
}

function filterJobs(
	jobsByJnid: Record<string, JobBaseData>,
	filters: JobFilters,
): JobBaseData[] {
	const earliestCreatedDateLocal = filters.earliestCreatedDate
		? dateInputToLocalDate(filters.earliestCreatedDate)
		: null;
	const latestCreatedDateLocal = filters.latestCreatedDate
		? dateInputToLocalDate(filters.latestCreatedDate)
		: null;

	return Object.values(jobsByJnid)
		.filter((job) => {
			if (earliestCreatedDateLocal && job.createdDate < earliestCreatedDateLocal) {
				return false;
			}
			if (latestCreatedDateLocal && job.createdDate > latestCreatedDateLocal) {
				return false;
			}
			if (filters.selectedBranch !== "" && job.state !== filters.selectedBranch) {
				return false;
			}
			if (
				filters.selectedSalesReps.length > 0 &&
				(job.salesRep === null || !filters.selectedSalesReps.includes(job.salesRep))
			) {
				return false;
			}
			if (
				filters.selectedLeadSources.length > 0 &&
				(job.leadSourceName === null ||
					!filters.selectedLeadSources.includes(job.leadSourceName))
			) {
				return false;
			}
			return true;
		})
		.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
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
			<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="mb-0">Selected jobs</h2>
				<p className="text-sm text-slate-600">
					{jobs.length} job{jobs.length === 1 ? '' : 's'} matching filters
				</p>
			</div>

			{jobs.length === 0 ? (
				<p className="text-sm text-slate-500">No jobs match the current filters.</p>
			) : (
				<>
					<div className="overflow-x-auto">
						<table className="table text-sm">
							<thead>
								<tr className="table-header-row">
									<th className="table-header-cell">Name</th>
									<th className="table-header-cell">Created date</th>
									<th className="table-header-cell">Status</th>
									<th className="table-header-cell">Job number</th>
								</tr>
							</thead>
							<tbody>
								{pageJobs.map((job) => {
									const href = jobNimbusJobUrl(job.jnid);
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
											<td className="table-cell">{job.jobName ?? '—'}</td>
											<td className="table-cell">{formatJobDate(job.createdDate)}</td>
											<td className="table-cell">
												{formatJobStatusWithGroup(job.status.name, statusNameToGroup)}
											</td>
											<td className="table-cell">{job.jobNumber ?? '—'}</td>
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

function formatJobDate(date: Date) {
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function dateInputToLocalDate(value: string) {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export default SalesKpisPage;
