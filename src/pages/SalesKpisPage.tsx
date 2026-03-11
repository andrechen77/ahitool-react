import { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import Select, { type MultiValue } from 'react-select';
import {
	DndContext,
	PointerSensor,
	useSensor,
	useSensors,
	closestCenter,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
	arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateKpiGraph, type KpiSankeyData } from '../lib/job_nimbus/kpi';
import JnClient from '../components/JnClient';
import { useJobNimbusData, type JobNimbusData } from '../contexts/JobNimbusDataContext';
import { useSavedState } from '../hooks/useSavedState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

function SalesKpisPage() {
	const { data: jnData } = useJobNimbusData();

	return (
		<section>
			<h1>Sales KPIs</h1>
			<JnClient />
			{jnData && <SalesKpisContent jnData={jnData} />}
		</section>
	);
}

function SalesKpisContent({ jnData }: { jnData: JobNimbusData }) {
	const { statuses, leadSources: _, activitiesByJobJnid, jobsByJnid } = jnData;

	const [statusGroups, setStatusGroups] = useSavedState<StatusGroup[]>(
		"sales-kpis:status_groups",
		JSON.stringify,
		str => {
			const statusGroups = JSON.parse(str) as StatusGroup[];
			return statusGroups.map((group, index) => ({
				id: `group-${index}`,
				groupName: group.groupName,
				statusNames: group.statusNames,
			}));
		},
		() => []
	);
	const [nextGroupId, setNextGroupId] = useState(statusGroups.length);
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
	const statusOptions = useMemo<StatusOption[]>(() => {
		let statusOptions: StatusOption[] = [];
		let seenStatusNames = new Set<string>();
		for (const status of Object.values(statuses)) {
			if (seenStatusNames.has(status.name)) {
				continue;
			}
			seenStatusNames.add(status.name);
			statusOptions.push({
				value: status.name,
				label: `${status.name}`,
			});
		}
		return statusOptions;
	}, [statuses]);
	const [minJobsPerFlow, setMinJobsPerFlow] = useSavedState<string>("sales-kpis:min_jobs_per_flow", String, String, () => "");

	const [plotlyLayout] = useState({
		autosize: true,
	});

	const availableOptionsByGroupId = useMemo<Record<string, StatusOption[]>>(
		() => {
			const result: Record<string, StatusOption[]> = {};
			statusGroups.forEach((group) => {
				const usedStatusNames = new Set<string>();
				statusGroups.forEach((otherGroup) => {
					if (otherGroup.id !== group.id) {
						otherGroup.statusNames.forEach(name => usedStatusNames.add(name));
					}
				});
				result[group.id] = statusOptions.filter(
					(option) =>
						!usedStatusNames.has(option.value) ||
						group.statusNames.includes(option.value),
				);
			});

			return result;
		},
		[statusGroups, statusOptions],
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 },
		}),
	);
	const handleDeleteLastGroup = () => {
		setStatusGroups((prev) => prev.slice(0, -1));
	};
	const handleAddGroup = () => {
		setStatusGroups((prev) => [
			...prev,
			{
				id: `group-${nextGroupId}`,
				groupName: `Group ${nextGroupId}`,
				statusNames: [],
			},
		]);
		setNextGroupId((prev) => prev + 1);
	};
	const handleGroupNameChange = (id: string, name: string) => {
		setStatusGroups((prev) =>
			prev.map((group) => (group.id === id ? { ...group, groupName: name } : group)),
		);
	};
	const handleGroupStatusesChange = (id: string, statusNames: string[]) => {
		setStatusGroups((prev) =>
			prev.map((group) => (group.id === id ? { ...group, statusNames } : group)),
		);
	};
	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}

		setStatusGroups((items) => {
			const oldIndex = items.findIndex((item) => item.id === active.id);
			const newIndex = items.findIndex((item) => item.id === over.id);
			if (oldIndex === -1 || newIndex === -1) {
				return items;
			}
			return arrayMove(items, oldIndex, newIndex);
		});
	};

	const calculateSankeyData = async () => {
		const statusGroupsObj = statusGroups.reduce((acc, group) => {
			acc[group.groupName] = [...group.statusNames];
			return acc;
		}, {} as Record<string, string[]>);
		const { data, invisibleJobs } = await generateKpiGraph(statusGroupsObj, activitiesByJobJnid, jobsByJnid);

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
		<Card className="mt-8">
			<h2 className="mb-2">Job Flows</h2>

			<p className="mb-3 text-sm text-slate-600">
				This tool lets you generate a Sankey diagram that track the
				flow of jobs between predefined "status groups." For example,
				defining a "leads" status group and an "appointments" status
				group lets you figure out how many leads turn into appointments.
			</p>

			<div>
				<div className="mb-2 flex items-center justify-between">
					<h3>Status groups</h3>
					<div className="flex items-center gap-2">
						<Button type="button" onClick={handleAddGroup}>
							Add group
						</Button>
						<Button
							type="button"
							variant="secondary"
							onClick={handleDeleteLastGroup}
							disabled={statusGroups.length === 0}
						>
							Delete last group
						</Button>
					</div>
				</div>
				{statusGroups.length === 0 ? (
					<p className="text-sm text-slate-500">
						Define status groups here. Click &quot;Add group&quot; to create your first one.
					</p>
				) : (
					<div className="max-h-96 overflow-y-auto pr-1">
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={statusGroups.map((group) => group.id)}
								strategy={verticalListSortingStrategy}
							>
								{statusGroups.map((group) => (
									<StatusGroupItem
										key={group.id}
										group={group}
										statusOptions={
											availableOptionsByGroupId[group.id] ?? statusOptions
										}
										onNameChange={handleGroupNameChange}
										onStatusesChange={handleGroupStatusesChange}
									/>
								))}
							</SortableContext>
						</DndContext>
					</div>
				)}
			</div>

			<div className="mt-4">
				<h3 className="mb-2">Other graph settings</h3>
				<div className="w-48">
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

			<Button onClick={calculateSankeyData} size="md" className="mt-4">
				Generate Sankey Diagram
			</Button>

			<Plot
				data={plotlyInputData}
				layout={plotlyLayout}
				useResizeHandler
			/>
		</Card>
	);
}

interface StatusGroup {
	id: string;
	groupName: string;
	statusNames: string[];
}

interface StatusOption {
	value: string;
	label: string;
}

interface StatusGroupItemProps {
	group: StatusGroup;
	statusOptions: StatusOption[];
	onNameChange: (id: string, name: string) => void;
	onStatusesChange: (id: string, statusNames: string[]) => void;
}

function StatusGroupItem({
	group,
	statusOptions,
	onNameChange,
	onStatusesChange,
}: StatusGroupItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: group.id,
	});
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};
	const selectedOptions = group.statusNames.map(name => statusOptions.find(option => option.value === name) ?? { value: name, label: `Unknown status ${name}` });
	return (
		<div
			ref={setNodeRef}
			style={style}
			className="cursor-grab mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
			{...attributes}
			{...listeners}
		>
			<div className="flex gap-3">
				<div className="mb-2 w-1/5">
					<label className="mb-1 block text-xs font-medium text-slate-600">
						Group name
					</label>
					<Input
						type="text"
						size="sm"
						value={group.groupName}
						onChange={(e) => onNameChange(group.id, e.target.value)}
						placeholder="e.g. Installed"
					/>
				</div>
				<div className="mb-2 flex-1">
					<label className="mb-1 block text-xs font-medium text-slate-600">
						Statuses in this group
					</label>
					<Select
						isMulti
						menuPortalTarget={document.body}
						menuPosition="fixed"
						styles={{
							menuPortal: (base) => ({ ...base, zIndex: 9999 }),
						}}
						options={statusOptions}
						value={selectedOptions}
						onChange={(selected: MultiValue<StatusOption>) => {
							const values = selected.map((option) => option.value);
							onStatusesChange(group.id, values);
						}}
						classNamePrefix="status-select"
						placeholder="Select statuses..."
					/>
				</div>
			</div>
		</div>
	);
}

export default SalesKpisPage;
