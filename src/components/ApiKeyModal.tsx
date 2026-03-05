import type React from 'react';
import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useApiKeyModal } from '../contexts/ApiKeyModalContext';
import { Input } from './Input';
import { Button } from './Button';

type FormOnSubmit = React.ComponentPropsWithoutRef<'form'>['onSubmit'];

export function ApiKeyModal() {
	const { isOpen, closeModal } = useApiKeyModal();
	const [apiKey, setApiKey] = useState('');
	const [textType, setTextType] = useState<'password' | 'text'>('password');

	useEffect(() => {
		setApiKey(localStorage.getItem('job_nimbus_api_key') ?? '');
	}, [isOpen]);

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
		<div className="modal-overlay" onClick={handleOverlayClick}>
			<div className="modal-panel" onClick={(e) => e.stopPropagation()}>
				<h2 className="mb-3 text-xl font-semibold text-slate-900">
					JobNimbus API Key
				</h2>
				<p className="mb-6 text-sm text-slate-600">
					A JobNimbus API key is required to access JobNimbus data.
				</p>
				<form onSubmit={handleApiKeySubmit}>
					<div className="relative mb-6">
						<Input
							type={textType}
							size="lg"
							className="pr-10"
							placeholder="Enter your API key here"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							autoFocus
						/>
						<button
							type="button"
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
							onClick={() => setTextType(textType === 'password' ? 'text' : 'password')}
							title={textType === 'password' ? 'Show key' : 'Hide key'}
						>
							{textType === 'password' ? <FaEye /> : <FaEyeSlash />}
						</button>
					</div>
					{!isValidLength && <p className="text-red-500">Expected 16 characters.</p>}
					<div className="flex justify-end gap-3">
						<Button type="submit" size="md">
							Save
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
