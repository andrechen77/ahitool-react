import { useJobNimbusData } from '../contexts/JobNimbusDataContext';

function JnClient() {
	const {
		activitiesByJobJnid,
		jobsByJnid,
		statuses,
		leadSources,
		isLoading,
		refresh,
	} = useJobNimbusData();

	return (
		<div className="border border-slate-300 rounded-md p-4 my-2">
			<h2 className="text-lg font-bold">JobNimbus Data</h2>
			{isLoading && <p>Loading JobNimbus data...</p>}
			<p>
				<span className="font-semibold">Job Statuses:</span> {Object.keys(statuses).length}
			</p>
			<p>
				<span className="font-semibold">Lead Sources:</span> {Object.keys(leadSources).length}
			</p>
			<p>
				<span className="font-semibold">Jobs loaded:</span> {Object.keys(jobsByJnid).length}
			</p>
			<p>
				<span className="font-semibold">Total activities:</span> {Object.values(activitiesByJobJnid).reduce((acc, arr) => acc + arr.length, 0)}
			</p>
			{/* data display here */}
			<button
				onClick={refresh}
				className="bg-blue-500 text-white px-4 py-2 rounded-md my-2 cursor-pointer"
				disabled={isLoading}
			>
				Refresh Data
			</button>
		</div>
	);
}

export default JnClient;
