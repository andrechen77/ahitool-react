import { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';
import { Button } from './Button';
import { Card } from './Card';
import { cn } from '../lib/cn';

type Tab = 'overview' | 'statuses' | 'leadSources';

function JnClient() {
	const {
		activitiesByJobJnid,
		jobsByJnid,
		statuses,
		leadSources,
		isLoading,
		refresh,
	} = useJobNimbusData();

	const { openModal } = useApiKeyModal();
	const [activeTab, setActiveTab] = useState<Tab>('overview');

	useEffect(() => {
		refresh(false);
	}, []);

	const statusesArray = Object.values(statuses);
	const leadSourcesArray = Object.values(leadSources);

	return (
		<Card className="my-2">
			<div className="flex items-center gap-2 mb-4">
				<h2 className="text-lg font-bold">JobNimbus Data</h2>
				<Button
					onClick={() => refresh(true)}
					variant="ghost"
					icon
					disabled={isLoading}
					title="Refresh data"
				>
					<FaSyncAlt className={isLoading ? 'animate-spin' : ''} />
				</Button>
			</div>

			<div className="border-b border-slate-300 mb-4">
				<div className="tabs">
					<button
						onClick={() => setActiveTab('overview')}
						className={cn(
							'tab',
							activeTab === 'overview' ? 'tab-active' : 'tab-inactive',
						)}
					>
						Overview
					</button>
					<button
						onClick={() => setActiveTab('statuses')}
						className={cn(
							'tab',
							activeTab === 'statuses' ? 'tab-active' : 'tab-inactive',
						)}
					>
						Statuses
					</button>
					<button
						onClick={() => setActiveTab('leadSources')}
						className={cn(
							'tab',
							activeTab === 'leadSources' ? 'tab-active' : 'tab-inactive',
						)}
					>
						Lead Sources
					</button>
				</div>
			</div>

			{isLoading && <p>Loading JobNimbus data...</p>}

			{activeTab === 'overview' && (
				<div>
					<p>
						<span className="font-semibold">Job statuses:</span> {Object.keys(statuses).length}
					</p>
					<p>
						<span className="font-semibold">Lead sources:</span> {Object.keys(leadSources).length}
					</p>
					<p>
						<span className="font-semibold">Jobs loaded:</span> {Object.keys(jobsByJnid).length}
					</p>
					<p>
						<span className="font-semibold">Total activities:</span> {Object.values(activitiesByJobJnid).reduce((acc, arr) => acc + arr.length, 0)}
					</p>
					<Button type="button" variant="secondary" onClick={openModal}>
						Update API Key
					</Button>
				</div>
			)}

			{activeTab === 'statuses' && (
				<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
					<table className="table">
						<thead className="table-header-sticky">
							<tr className="table-header-row">
								<th className="table-header-cell">Internal ID</th>
								<th className="table-header-cell">Name</th>
							</tr>
						</thead>
						<tbody>
							{statusesArray.map((status) => (
								<tr key={status.id} className="table-row">
									<td className="table-cell">{status.id}</td>
									<td className="table-cell">{status.name}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{activeTab === 'leadSources' && (
				<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
					<table className="table">
						<thead className="table-header-sticky">
							<tr className="table-header-row">
								<th className="table-header-cell">Internal ID</th>
								<th className="table-header-cell">Name</th>
							</tr>
						</thead>
						<tbody>
							{leadSourcesArray.map((source) => (
								<tr key={source.id} className="table-row">
									<td className="table-cell">{source.id}</td>
									<td className="table-cell">{source.name}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

export default JnClient;
