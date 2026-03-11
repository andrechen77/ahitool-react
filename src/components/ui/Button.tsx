import type React from 'react';
import { cn } from '../../util/cn';

type ButtonVariant = 'primary' | 'secondary' | 'error' | 'ghost';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	icon?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
	primary: 'btn btn-primary',
	secondary: 'btn btn-secondary',
	error: 'btn btn-error',
	ghost: 'btn btn-ghost',
};

const sizeClassNames: Record<ButtonSize, string> = {
	sm: 'btn-sm',
	md: 'btn-md',
};

export function Button({
	variant = 'primary',
	size = 'sm',
	icon = false,
	className,
	children,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(
				variantClassNames[variant],
				sizeClassNames[size],
				icon && 'btn-icon',
				'cursor-pointer',
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}
