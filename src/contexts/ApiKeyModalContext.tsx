import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ApiKeyModalContextType {
	isOpen: boolean,
	message: string,
	openModal: (message: string) => void,
	closeModal: () => void,
	apiKey: string,
	setApiKey: (apiKey: string) => void,
}

const ApiKeyModalContext = createContext<ApiKeyModalContextType | undefined>(undefined);

export function ApiKeyModalProvider({ children }: { children: ReactNode }) {
	const [apiKey, setApiKey] = useState<string>(() => {
		return localStorage.getItem('job_nimbus_api_key') ?? "";
	});
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState<string>("Enter your JobNimbus API key here");

	useEffect(() => {
		localStorage.setItem('job_nimbus_api_key', apiKey);
	}, [apiKey]);

	const value = {
		isOpen,
		message,
		openModal: (message: string) => {
			setIsOpen(true);
			setMessage(message);
		},
		closeModal: () => {
			setIsOpen(false);
		},
		apiKey,
		setApiKey,
	};

	return (
		<ApiKeyModalContext.Provider value={value}>
			{children}
		</ApiKeyModalContext.Provider>
	);
}

export function useApiKey(): ApiKeyModalContextType {
	const context = useContext(ApiKeyModalContext);
	if (context === undefined)
		throw new Error('useApiKeyModal must be used within an ApiKeyModalProvider');
	return context;
}
