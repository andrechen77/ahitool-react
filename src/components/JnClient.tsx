import { useState, useEffect } from 'react';
import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';

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
		<div className="border border-slate-300 rounded-md p-4 my-2">
			<div className="flex items-center gap-2 mb-4">
				<h2 className="text-lg font-bold">JobNimbus Data</h2>
				<button
					onClick={() => refresh(true)}
					className="p-1 hover:bg-slate-200 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={isLoading}
					title="Refresh data"
				>
					<FaSyncAlt className={isLoading ? 'animate-spin' : ''} />
				</button>
			</div>

			<div className="border-b border-slate-300 mb-4">
				<div className="flex gap-2">
					<button
						onClick={() => setActiveTab('overview')}
						className={`px-4 py-2 font-medium transition-colors ${activeTab === 'overview'
							? 'border-b-2 border-slate-900 text-slate-900'
							: 'text-slate-600 hover:text-slate-900'
							}`}
					>
						Overview
					</button>
					<button
						onClick={() => setActiveTab('statuses')}
						className={`px-4 py-2 font-medium transition-colors ${activeTab === 'statuses'
							? 'border-b-2 border-slate-900 text-slate-900'
							: 'text-slate-600 hover:text-slate-900'
							}`}
					>
						Statuses
					</button>
					<button
						onClick={() => setActiveTab('leadSources')}
						className={`px-4 py-2 font-medium transition-colors ${activeTab === 'leadSources'
							? 'border-b-2 border-slate-900 text-slate-900'
							: 'text-slate-600 hover:text-slate-900'
							}`}
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
					<button onClick={openModal} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
						Update API Key
					</button>
				</div>
			)}

			{activeTab === 'statuses' && (
				<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
					<table className="w-full border-collapse">
						<thead className="sticky top-0 bg-white">
							<tr className="border-b border-slate-300">
								<th className="text-left py-1 px-2 font-semibold">Internal ID</th>
								<th className="text-left py-1 px-2 font-semibold">Name</th>
							</tr>
						</thead>
						<tbody>
							{statusesArray.map((status) => (
								<tr key={status.id} className="border-b border-slate-200">
									<td className="py-1 px-2">{status.id}</td>
									<td className="py-1 px-2">{status.name}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{activeTab === 'leadSources' && (
				<div className="max-h-96 overflow-y-auto border border-slate-200 rounded-md">
					<table className="w-full border-collapse">
						<thead className="sticky top-0 bg-white">
							<tr className="border-b border-slate-300">
								<th className="text-left py-1 px-2 font-semibold">Internal ID</th>
								<th className="text-left py-1 px-2 font-semibold">Name</th>
							</tr>
						</thead>
						<tbody>
							{leadSourcesArray.map((source) => (
								<tr key={source.id} className="border-b border-slate-200">
									<td className="py-1 px-2">{source.id}</td>
									<td className="py-1 px-2">{source.name}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

export default JnClient;
