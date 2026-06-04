import { useEffect, useMemo, useState } from 'react';
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
import type { JobStatusRegistry } from '../lib/job_nimbus/domain';
import { useSavedState } from '../hooks/useSavedState';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export interface StatusGroup {
	id: string;
	groupName: string;
	statusNames: string[];
}

interface StatusOption {
	value: string;
	label: string;
}

interface StatusGroupsProps {
	statuses: JobStatusRegistry;
	storageKey?: string;
	onStatusGroupsChange?: (groups: StatusGroup[]) => void;
}

export function statusGroupsToRecord(groups: StatusGroup[]): Record<string, string[]> {
	return groups.reduce((acc, group) => {
		acc[group.groupName] = [...group.statusNames];
		return acc;
	}, {} as Record<string, string[]>);
}

export function buildStatusNameToGroupMap(groups: StatusGroup[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const group of groups) {
		for (const statusName of group.statusNames) {
			if (!map.has(statusName)) {
				map.set(statusName, group.groupName);
			}
		}
	}
	return map;
}

export function formatJobStatusWithGroup(
	statusName: string,
	statusNameToGroup: Map<string, string>,
): string {
	const groupName = statusNameToGroup.get(statusName);
	if (groupName) {
		return `${groupName} (${statusName})`;
	}
	return `— (${statusName})`;
}

export function StatusGroups({
	statuses,
	storageKey = 'sales-kpis:status_groups',
	onStatusGroupsChange,
}: StatusGroupsProps) {
	const [statusGroups, setStatusGroups] = useSavedState<StatusGroup[]>(
		storageKey,
		JSON.stringify,
		(str) => {
			const parsed = JSON.parse(str) as StatusGroup[];
			return parsed.map((group, index) => ({
				id: `group-${index}`,
				groupName: group.groupName,
				statusNames: group.statusNames,
			}));
		},
		() => [],
	);
	const [nextGroupId, setNextGroupId] = useState(statusGroups.length);

	const statusOptions = useMemo<StatusOption[]>(() => {
		const options: StatusOption[] = [];
		const seenStatusNames = new Set<string>();
		for (const status of Object.values(statuses)) {
			if (seenStatusNames.has(status.name)) {
				continue;
			}
			seenStatusNames.add(status.name);
			options.push({
				value: status.name,
				label: status.name,
			});
		}
		return options;
	}, [statuses]);

	const availableOptionsByGroupId = useMemo<Record<string, StatusOption[]>>(
		() => {
			const result: Record<string, StatusOption[]> = {};
			statusGroups.forEach((group) => {
				const usedStatusNames = new Set<string>();
				statusGroups.forEach((otherGroup) => {
					if (otherGroup.id !== group.id) {
						otherGroup.statusNames.forEach((name) => usedStatusNames.add(name));
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

	useEffect(() => {
		onStatusGroupsChange?.(statusGroups);
	}, [statusGroups, onStatusGroupsChange]);

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

	return (
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
	);
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
	const selectedOptions = group.statusNames.map(
		(name) =>
			statusOptions.find((option) => option.value === name) ?? {
				value: name,
				label: `Unknown status ${name}`,
			},
	);
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
