import type React from 'react';
import { cn } from '../../util/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	icon?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
	primary: 'btn btn-primary',
	secondary: 'btn btn-secondary',
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
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}
