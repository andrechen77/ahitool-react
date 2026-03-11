import { Link } from 'react-router-dom';

type ToolCardProps = {
  to: string;
  title: string;
  description: string;
  image: React.ReactNode;
};

function ToolCard({ to, title, description, image }: ToolCardProps) {
  return (
    <Link
      to={to}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      aria-label={`${title}: ${description}`}
    >
      <div className="aspect-video w-full bg-linear-to-br from-slate-50 to-slate-100">
        <div className="h-full w-full p-4">{image}</div>
      </div>
      <div className="p-4">
        <h2 className="text-base font-semibold text-slate-900 group-hover:text-sky-700">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

function HomePage() {
	return (
		<section className="space-y-5">
			<div>
				<h1 className="text-2xl font-bold mb-2">Welcome to ahitool</h1>
				<p className="text-slate-600">Select a tool to get started.</p>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<ToolCard
					to="/sales-kpis"
					title="Sales KPIs"
					description="Explore sales performance, conversion, and flow insights from JobNimbus data."
					image={
						<div className="flex h-full w-full items-center justify-center">
							<svg
								viewBox="0 0 320 180"
								className="h-full w-full"
								role="img"
								aria-label="Sales KPI preview"
								preserveAspectRatio="xMidYMid meet"
							>
								<defs>
									<linearGradient id="kpiBg" x1="0" y1="0" x2="1" y2="1">
										<stop offset="0" stopColor="#0ea5e9" stopOpacity="0.16" />
										<stop offset="1" stopColor="#22c55e" stopOpacity="0.14" />
									</linearGradient>
									<linearGradient id="kpiLine" x1="0" y1="0" x2="1" y2="0">
										<stop offset="0" stopColor="#0ea5e9" />
										<stop offset="1" stopColor="#22c55e" />
									</linearGradient>
								</defs>

								<rect x="0" y="0" width="320" height="180" rx="14" fill="url(#kpiBg)" />

								<g opacity="0.35" stroke="#0f172a" strokeWidth="1">
									<line x1="26" y1="140" x2="294" y2="140" />
									<line x1="26" y1="108" x2="294" y2="108" />
									<line x1="26" y1="76" x2="294" y2="76" />
									<line x1="26" y1="44" x2="294" y2="44" />
								</g>

								<g>
									<path
										d="M26 128 C60 120, 78 98, 108 102 C138 106, 154 68, 184 72 C214 76, 232 56, 262 58 C282 60, 292 44, 294 38"
										fill="none"
										stroke="url(#kpiLine)"
										strokeWidth="4"
										strokeLinecap="round"
									/>
									<circle cx="108" cy="102" r="5" fill="#0ea5e9" />
									<circle cx="184" cy="72" r="5" fill="#22c55e" />
									<circle cx="262" cy="58" r="5" fill="#16a34a" />
								</g>

								<g fontFamily="ui-sans-serif, system-ui, -apple-system" fill="#0f172a">
									<text x="26" y="28" fontSize="14" fontWeight="700" opacity="0.85">
										Sales KPIs
									</text>
									<text x="26" y="162" fontSize="11" opacity="0.6">
										Conversion • Flow • Trend
									</text>
								</g>
							</svg>
						</div>
					}
				/>
			</div>
		</section>
	);
}

export default HomePage;
