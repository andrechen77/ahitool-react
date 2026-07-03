import { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useApiKey } from '../contexts/ApiKeyModalContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { cn } from '../util/cn';
import { ApiKeyError } from '../lib/job_nimbus/api';

type Tab = 'apiKey' | 'overview' | 'statuses' | 'leadSources' | 'salesReps';

function JnClient() {
	const { metadata, isLoadingMetadata, loadMetadata } = useJobNimbusData();

	const statuses = metadata?.statuses ?? {};
	const leadSources = metadata?.leadSources ?? {};

	const { apiKey, openModal } = useApiKey();
	const [activeTab, setActiveTab] = useState<Tab>('overview');

	useEffect(() => {
		if (apiKey && apiKey.length === 16) {
			handleRefresh();
		} else if (apiKey === "") {
			openModal("Enter an API key to access JobNimbus data.");
			setActiveTab('apiKey');
		}
	}, []);

	const statusesArray = Object.values(statuses);
	const leadSourcesArray = Object.values(leadSources);

	const handleRefresh = async () => {
		try {
			await loadMetadata(apiKey);
		} catch (error) {
			if (error instanceof ApiKeyError) {
				openModal("Invalid API key. Make sure you entered the key correctly.");
			} else {
				throw error;
			}
		}
		setActiveTab('overview');
	};

	const suggestRefresh = apiKey.length > 0 && metadata === null && !isLoadingMetadata;

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
						disabled={isLoadingMetadata}
						title="Refresh metadata"
					>
						<FaSyncAlt className={isLoadingMetadata ? 'animate-spin' : ''} />
					</Button>
					{suggestRefresh ? (
						<p className="text-sm text-slate-500">Load data</p>
					) : isLoadingMetadata ? (
						<p className="text-sm text-slate-500">Loading metadata...</p>
					) : metadata !== null ? (
						<p className="text-sm text-slate-500">Metadata loaded</p>
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
					<TabButton tab="salesReps" activeTab={activeTab} setActiveTab={setActiveTab}>
						Sales Reps
					</TabButton>
				</div>
			</div>

			{isLoadingMetadata && <p>Loading metadata...</p>}

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
						<span className="font-semibold">Sales reps:</span> {metadata?.salesReps.length ?? 0}
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

			{activeTab === 'salesReps' && (
				<div>
					<p className="mb-3 text-xs text-slate-500 italic">
						This list includes all users on the JobNimbus account. Some may not be sales reps.
					</p>
					<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
						<table className="table">
							<thead className="table-header-sticky">
								<tr className="table-header-row">
									<th className="table-header-cell">Name</th>
								</tr>
							</thead>
							<tbody>
								{(metadata?.salesReps ?? []).map((name, index) => (
									<tr key={index} className="table-row">
										<td className="table-cell">{name}</td>
									</tr>
								))}
							</tbody>
						</table>
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
