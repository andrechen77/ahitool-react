import { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useApiKey } from '../contexts/ApiKeyModalContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { cn } from '../util/cn';
import { ApiKeyError } from '../lib/job_nimbus/api';

type Tab = 'apiKey' | 'overview' | 'statuses' | 'leadSources' | 'jobs';

function JnClient() {
	const {
		data: jnData,
		isLoading,
		refresh,
	} = useJobNimbusData();

	const statuses = jnData?.statuses ?? {};
	const leadSources = jnData?.leadSources ?? {};
	const jobsByJnid = jnData?.jobsByJnid ?? {};
	const activitiesByJobJnid = jnData?.activitiesByJobJnid ?? {};

	const { apiKey, openModal } = useApiKey();
	const [activeTab, setActiveTab] = useState<Tab>('overview');
	const [jobJnidQuery, setJobJnidQuery] = useState('');

	useEffect(() => {
		refresh(null).catch(error => {
			if (error instanceof ApiKeyError) {
				// we expect and ignore this since we pass null as the API key,
				// preventing a fetch

				// except if the user hasn't entered an API key yet, then nudge
				// them
				if (apiKey === "") {
					openModal("Enter an API key to access JobNimbus data.");
					setActiveTab('apiKey');
				}
			} else {
				throw error;
			}
		});
	}, []);

	const statusesArray = Object.values(statuses);
	const leadSourcesArray = Object.values(statuses);

	const handleRefresh = async () => {
		try {
			await refresh(apiKey);
		} catch (error) {
			if (error instanceof ApiKeyError) {
				openModal("Invalid API key. Make sure you entered the key correctly.");
			} else {
				throw error;
			}
		}
		setActiveTab('overview');
	};

	const suggestRefresh = apiKey.length > 0 && jnData === null && !isLoading;

	return (
		<Card className="my-2">
			<div className="flex items-center gap-2 mb-4">
				<h2>JobNimbus Data</h2>
				<div className="flex items-center gap-2">
					<Button
						onClick={handleRefresh}
						variant="ghost"
						className={suggestRefresh ? 'pop-button' : ''}
						icon
						disabled={isLoading}
						title="Refresh data"
					>
						<FaSyncAlt className={isLoading ? 'animate-spin' : ''} />
					</Button>
					{suggestRefresh ? (
						<p className="text-sm text-slate-500">Refresh data</p>
					) : isLoading ? (
						<p className="text-sm text-slate-500">Loading data. This may take a minute...</p>
					) : jnData !== null ? (
						<p className="text-sm text-slate-500">Data loaded</p>
					) : null}
				</div>
			</div>

			<div className="border-b border-slate-300 mb-4">
				<div className="tabs">
					<TabButton tab="apiKey" activeTab={activeTab} setActiveTab={setActiveTab}>
						API Key
					</TabButton>
					<TabButton tab="overview" activeTab={activeTab} setActiveTab={setActiveTab}>
						Overview
					</TabButton>
					<TabButton tab="statuses" activeTab={activeTab} setActiveTab={setActiveTab}>
						Statuses
					</TabButton>
					<TabButton tab="leadSources" activeTab={activeTab} setActiveTab={setActiveTab}>
						Lead Sources
					</TabButton>
					<TabButton tab="jobs" activeTab={activeTab} setActiveTab={setActiveTab}>
						Jobs
					</TabButton>
				</div>
			</div>

			{isLoading && <p>Loading JobNimbus data...</p>}

			{activeTab === 'apiKey' && (
				<div>
					<Button type="button" variant={apiKey === "" ? "error" : "secondary"} onClick={() => openModal("Enter your JobNimbus API key here")}>
						Update API Key
					</Button>
				</div>
			)}

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

function TabButton({ tab, activeTab, setActiveTab, children }: { tab: Tab, activeTab: Tab, setActiveTab: (tab: Tab) => void, children: React.ReactNode }) {
	return (
		<button
			onClick={() => setActiveTab(tab)}
			className={cn(
				'cursor-pointer tab',
				activeTab === tab ? 'tab-active' : 'tab-inactive',
			)}
		>
			{children}
		</button>
	);
}

export default JnClient;
