import { useState } from 'react';
import Plot from 'react-plotly.js';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';
import { generateKpiGraph, type KpiSankeyData } from '../lib/job_nimbus/kpi';
import { getAllJobActivities, getJobStatuses } from '../lib/job_nimbus/api';
import type { JnActivity } from '../lib/job_nimbus/types';
import JnClient from '../components/JnClient';

const DEFAULT_GRAPH_SETTINGS = 'a: b, c\nd: e, f';

function SalesKpisPage() {
	const { openModal } = useApiKeyModal();
	const [graphSettings, setGraphSettings] = useState('');
	const [sankeyData, setSankeyData] = useState<KpiSankeyData>({
		nodeNames: [],
		sourceIds: [],
		targetIds: [],
		jobs: [],
		averageDurationMs: [],
	});
	const [sankeyLayout] = useState({
		title: 'Sales Flow (placeholder Sankey)',
		font: { size: 12 },
	});

	const calculateSankeyData = async () => {
		const statuses = await getJobStatuses();
		const activities = await getAllJobActivities();
		const activitiesByJobJnid = activities.reduce((acc, activity) => {
			acc[activity.primaryJnid] = [...(acc[activity.primaryJnid] ?? []), activity];
			return acc;
		}, {} as Record<string, JnActivity[]>);
		const sankeyData = await generateKpiGraph(graphSettings, statuses, activitiesByJobJnid);
		setSankeyData(sankeyData);
	};

	return (
		<section>
			<h1 className="text-2xl font-bold">Sales KPIs</h1>

			<JnClient />

			<button onClick={openModal} className="bg-blue-500 text-white px-4 py-2 rounded-md my-2 cursor-pointer">
				Update API Key
			</button>

			<div style={{ marginTop: '2rem', maxWidth: 800 }}>
				<label
					htmlFor="graph-settings"
					style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}
				>
					Graph settings
				</label>
				<textarea
					id="graph-settings"
					value={graphSettings}
					onChange={(e) => setGraphSettings(e.target.value)}
					rows={6}
					style={{
						width: '100%',
						resize: 'vertical',
						fontFamily: 'monospace',
						fontSize: '0.9rem',
						padding: '0.5rem',
						borderRadius: 4,
						border: '1px solid #ccc',
					}}
					placeholder={DEFAULT_GRAPH_SETTINGS}
				/>
			</div>

			<button onClick={calculateSankeyData} className="bg-blue-500 text-white px-4 py-2 rounded-md cursor-pointer">Generate Sankey Diagram</button>

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
							hovertemplate: "%{source.label} -> %{target.label}<br>Average duration: %{customdata}",
						},
						customdata: sankeyData.averageDurationMs,
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

export default SalesKpisPage;
