import type React from 'react';
import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useApiKey } from '../contexts/ApiKeyModalContext';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

type FormOnSubmit = React.ComponentPropsWithoutRef<'form'>['onSubmit'];

export function ApiKeyModal() {
	const { isOpen, message, closeModal, apiKey, setApiKey } = useApiKey();
	const [textType, setTextType] = useState<'password' | 'text'>('password');

	const handleApiKeySubmit: FormOnSubmit = (e) => {
		e.preventDefault()
		if (apiKey.trim()) {
			setApiKey(apiKey.trim())
		}
		closeModal()
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
					{message}
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
