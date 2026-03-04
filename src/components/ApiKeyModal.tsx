import type React from 'react';
import { useState } from 'react';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';

type FormOnSubmit = React.ComponentPropsWithoutRef<'form'>['onSubmit'];

export function ApiKeyModal() {
	const { isOpen, closeModal } = useApiKeyModal();
	const [apiKey, setApiKey] = useState('');
	const [textType, setTextType] = useState<'password' | 'text'>('password');

	const handleApiKeySubmit: FormOnSubmit = (e) => {
		e.preventDefault()
		if (apiKey.trim()) {
			localStorage.setItem('job_nimbus_api_key', apiKey.trim())
			setApiKey('')
			closeModal()
		}
	};

	const handleOverlayClick = () => {
		closeModal()
	};

	const isValidLength = apiKey.length === 16;

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
			onClick={handleOverlayClick}
		>
			<div
				className="w-[90%] max-w-md rounded-lg bg-white p-8 shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="mb-3 text-xl font-semibold text-slate-900">
					JobNimbus API Key Required
				</h2>
				<p className="mb-6 text-sm text-slate-600">
					Please enter your JobNimbus API key to continue.
				</p>
				<form onSubmit={handleApiKeySubmit}>
					<input
						type={textType}
						className="mb-6 w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
						placeholder="Enter API key"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						autoFocus
					/>
					<button
						type="button"
						className="cursor-pointer"
						onClick={() => setTextType(textType === 'password' ? 'text' : 'password')}
					>
						{textType === 'password' ? 'show key' : 'hide key'}
					</button>
					{!isValidLength && <p className="text-red-500">Expected 16 characters.</p>}
					<div className="flex justify-end gap-3">
						<button
							type="submit"
							className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 active:bg-slate-700"
						>
							Save
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
