import { useApiKeyModal } from '../contexts/ApiKeyModalContext'

function SalesKpisPage() {
	const { openModal } = useApiKeyModal()

	return (
		<section>
			<h1>Sales KPIs</h1>
			<button onClick={openModal} style={{ marginTop: '1rem' }}>
				Update API Key
			</button>
		</section>
	)
}

export default SalesKpisPage
