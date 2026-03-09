import { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { cn } from '../util/cn';
import { ApiKeyError } from '../lib/job_nimbus/api';

type Tab = 'overview' | 'statuses' | 'leadSources' | 'jobs';

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
	const [jobJnidQuery, setJobJnidQuery] = useState('');

	useEffect(() => {
		refresh(false);
	}, []);

	const statusesArray = Object.values(statuses);
	const leadSourcesArray = Object.values(leadSources);

	const handleRefresh = async () => {
		try {
			await refresh(true);
		} catch (error) {
			if (error instanceof ApiKeyError) {
				openModal("Invalid API key");
			} else {
				throw error;
			}
		}
	}

	return (
		<Card className="my-2">
			<div className="flex items-center gap-2 mb-4">
				<h2>JobNimbus Data</h2>
				<Button
					onClick={handleRefresh}
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
					<button
						onClick={() => setActiveTab('jobs')}
						className={cn(
							'tab',
							activeTab === 'jobs' ? 'tab-active' : 'tab-inactive',
						)}
					>
						Jobs
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
					<Button type="button" variant="secondary" onClick={() => openModal(null)}>
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

			{activeTab === 'jobs' && (
				<div className="space-y-4">
					<div>
						<label className="block text-sm font-medium mb-1" htmlFor="job-jnid-input">
							Job JNID
						</label>
						<input
							id="job-jnid-input"
							type="text"
							value={jobJnidQuery}
							onChange={(e) => setJobJnidQuery(e.target.value)}
							placeholder="Enter a Job JNID"
							className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="border border-slate-200 rounded-md p-2 bg-slate-50">
							<h3 className="font-semibold mb-2 text-sm">jobsByJnid</h3>
							<pre className="text-xs whitespace-pre-wrap break-all max-h-80 overflow-auto">
								{JSON.stringify(
									jobJnidQuery ? jobsByJnid[jobJnidQuery] ?? null : null,
									null,
									2,
								)}
							</pre>
						</div>
						<div className="border border-slate-200 rounded-md p-2 bg-slate-50">
							<h3 className="font-semibold mb-2 text-sm">activitiesByJobJnid</h3>
							<pre className="text-xs whitespace-pre-wrap break-all max-h-80 overflow-auto">
								{JSON.stringify(
									jobJnidQuery ? activitiesByJobJnid[jobJnidQuery] ?? null : null,
									null,
									2,
								)}
							</pre>
						</div>
					</div>
				</div>
			)}
		</Card>
	);
}

export default JnClient;
