import type { JobStatusRegistry } from '../lib/job_nimbus/domain';
import { cn } from '../util/cn';
import { Button } from './ui/Button';
import { StatusGroups, type StatusGroup } from './StatusGroups';

interface StatusGroupsModalProps {
	isOpen: boolean;
	onClose: () => void;
	statuses: JobStatusRegistry;
	storageKey?: string;
	onStatusGroupsChange?: (groups: StatusGroup[]) => void;
}

export function StatusGroupsModal({
	isOpen,
	onClose,
	statuses,
	storageKey = 'sales-kpis:status_groups',
	onStatusGroupsChange,
}: StatusGroupsModalProps) {
	return (
		<div
			className={cn('modal-overlay', !isOpen && 'hidden')}
			onClick={isOpen ? onClose : undefined}
		>
			<div
				className="modal-panel max-h-[90vh] w-[95%] max-w-3xl overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="mb-4 text-xl font-semibold text-slate-900">Edit status groups</h2>
				<StatusGroups
					statuses={statuses}
					storageKey={storageKey}
					onStatusGroupsChange={onStatusGroupsChange}
				/>
				<div className="mt-6 flex justify-end">
					<Button type="button" size="md" onClick={onClose}>
						Done
					</Button>
				</div>
			</div>
		</div>
	);
}
