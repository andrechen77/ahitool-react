import { FaSyncAlt } from 'react-icons/fa';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';
import { useEffect } from 'react';

function JnClient() {
	const {
		activitiesByJobJnid,
		jobsByJnid,
		statuses,
		leadSources,
		isLoading,
		refresh,
	} = useJobNimbusData();

	useEffect(() => {
		refresh(false);
	}, []);

	return (
		<div className="border border-slate-300 rounded-md p-4 my-2">
			<div className="flex items-center gap-2 mb-2">
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
			{isLoading && <p>Loading JobNimbus data...</p>}
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
	);
}

export default JnClient;
