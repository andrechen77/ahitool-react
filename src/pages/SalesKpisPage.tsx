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
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import type { JobStatus } from '../lib/job_nimbus/types';
import { useSavedState } from '../lib/useSavedState';

function SalesKpisPage() {
	const { statuses, leadSources: _, activitiesByJobJnid, jobsByJnid } = useJobNimbusData();

	const [statusGroups, setStatusGroups] = useSavedState<StatusGroup[]>(
		"sales-kpis:status_groups",
		JSON.stringify,
		str => {
			const statusGroups = JSON.parse(str) as StatusGroup[];
			return statusGroups.map((group, index) => ({
				id: `group-${index}`,
				name: group.name,
				statusIds: group.statusIds,
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
	const statusOptions = useMemo<StatusOption[]>(() => {
		return Object.values(statuses).map((status) => ({
			value: status.id,
			label: `${status.name} (${status.id})`,
		}));
	}, [statuses]);

	const [sankeyLayout] = useState({
		title: 'Sales Flow (placeholder Sankey)',
		font: { size: 12 },
	});

	const availableOptionsByGroupId = useMemo<Record<string, StatusOption[]>>(
		() => {
			const result: Record<string, StatusOption[]> = {};

			statusGroups.forEach((group) => {
				const usedStatusIds = new Set<number>();

				statusGroups.forEach((otherGroup) => {
					if (otherGroup.id !== group.id) {
						otherGroup.statusIds.forEach((id) => usedStatusIds.add(id));
					}
				});

				result[group.id] = statusOptions.filter(
					(option) =>
						!usedStatusIds.has(option.value) ||
						group.statusIds.includes(option.value),
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
				name: `Group ${nextGroupId}`,
				statusIds: [],
			},
		]);
		setNextGroupId((prev) => prev + 1);
	};

	const handleGroupNameChange = (id: string, name: string) => {
		setStatusGroups((prev) =>
			prev.map((group) => (group.id === id ? { ...group, name } : group)),
		);
	};

	const handleGroupStatusesChange = (id: string, statusIds: number[]) => {
		setStatusGroups((prev) =>
			prev.map((group) => (group.id === id ? { ...group, statusIds } : group)),
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
			acc[group.name] = group.statusIds.map((id) => statuses[id]);
			return acc;
		}, {} as Record<string, JobStatus[]>);
		const { data, invisibleJobs } = await generateKpiGraph(statusGroupsObj, activitiesByJobJnid, jobsByJnid);
		console.log(`${invisibleJobs.length} jobs were not included in the graph because they had no edges`, invisibleJobs);
		setSankeyData(data);
	};

	return (
		<section>
			<h1 className="text-2xl font-bold">Sales KPIs</h1>

			<JnClient />

			<div className="mt-8 max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-lg font-semibold">Status groups</h2>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleAddGroup}
							className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors cursor-pointer hover:bg-slate-800 active:bg-slate-700"
						>
							Add group
						</button>
						<button
							type="button"
							onClick={handleDeleteLastGroup}
							disabled={statusGroups.length === 0}
							className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Delete last group
						</button>
					</div>
				</div>
				<p className="mb-3 text-sm text-slate-600">
					Create named groups of statuses that define the relevant transitions for jobs.
				</p>

				{statusGroups.length === 0 ? (
					<p className="text-sm text-slate-500">
						No groups yet. Click &quot;Add group&quot; to create your first one.
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

			<button onClick={calculateSankeyData} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors cursor-pointer hover:bg-slate-800 active:bg-slate-700">Generate Sankey Diagram</button>

			<div style={{ marginTop: '2rem' }}>
				<Plot
					data={[{
						type: 'sankey',
						name: 'Job Milestone Flow',
						orientation: 'h',
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
					}]}
					layout={{
						...sankeyLayout,
						autosize: true,
					}}
					useResizeHandler
				/>
			</div>
		</section>
	);
}

interface StatusGroup {
	id: string;
	name: string;
	statusIds: number[];
}

interface StatusOption {
	value: number;
	label: string;
}

interface StatusGroupItemProps {
	group: StatusGroup;
	statusOptions: StatusOption[];
	onNameChange: (id: string, name: string) => void;
	onStatusesChange: (id: string, statusIds: number[]) => void;
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
	const selectedOptions = group.statusIds.map(statusId => statusOptions.find(option => option.value === statusId) ?? { value: statusId, label: `Unknown status ${statusId}` });
	return (
		<div
			ref={setNodeRef}
			style={style}
			className="cursor-grab mb-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm"
			{...attributes}
			{...listeners}
		>
			<div className="flex gap-3">
				<div className="mb-2 w-1/5">
					<label className="mb-1 block text-xs font-medium text-slate-600">
						Group name
					</label>
					<input
						type="text"
						className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
						value={group.name}
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
