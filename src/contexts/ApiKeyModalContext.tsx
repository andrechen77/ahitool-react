import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ApiKeyModalContextType {
	isOpen: boolean,
	openModal: () => void,
	closeModal: () => void,
}

const ApiKeyModalContext = createContext<ApiKeyModalContextType | undefined>(undefined);

export function ApiKeyModalProvider({ children }: { children: ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const value = {
		isOpen,
		openModal: () => setIsOpen(true),
		closeModal: () => setIsOpen(false),
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
