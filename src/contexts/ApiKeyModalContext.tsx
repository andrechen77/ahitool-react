import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ApiKeyModalContextType {
	isOpen: boolean,
	message: string | null,
	openModal: (message: string | null) => void,
	closeModal: () => void,
}

const ApiKeyModalContext = createContext<ApiKeyModalContextType | undefined>(undefined);

export function ApiKeyModalProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const value = {
		isOpen,
		message,
		openModal: (message: string | null) => {
			setIsOpen(true);
			setMessage(message);
		},
		closeModal: () => {
			setIsOpen(false);
			setMessage(null);
		},
	};

	return (
		<ApiKeyModalContext.Provider value={value}>
			{children}
		</ApiKeyModalContext.Provider>
	);
}

export function useApiKeyModal(): ApiKeyModalContextType {
	const context = useContext(ApiKeyModalContext);
	if (context === undefined)
		throw new Error('useApiKeyModal must be used within an ApiKeyModalProvider');
	return context;
}
