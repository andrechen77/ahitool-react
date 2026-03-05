import { useState } from 'react';
import Plot from 'react-plotly.js';
import { generateKpiGraph, type KpiSankeyData } from '../lib/job_nimbus/kpi';
import JnClient from '../components/JnClient';
import { useJobNimbusData } from '../contexts/JobNimbusDataContext';

const PLACEHOLDER_GRAPH_SETTINGS = 'my status group: Hot Lead, Cold Lead\nmy other status group: Appointment Made, Contingency Signed';

function SalesKpisPage() {
	const { statuses, leadSources: _, activitiesByJobJnid, jobsByJnid } = useJobNimbusData();

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
		const { data, invisibleJobs } = await generateKpiGraph(graphSettings, statuses, activitiesByJobJnid, jobsByJnid);
		console.log(`${invisibleJobs.length} jobs were not included in the graph because they had no edges`, invisibleJobs);
		setSankeyData(data);
	};

	return (
		<section>
			<h1 className="text-2xl font-bold">Sales KPIs</h1>

			<JnClient />

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
					placeholder={PLACEHOLDER_GRAPH_SETTINGS}
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
