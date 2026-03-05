import React from 'react';
import { cn } from '../../util/cn';

type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
	size?: InputSize;
}

const sizeClassNames: Record<InputSize, string> = {
	sm: '',
	md: '',
	lg: 'input-lg',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ size = 'md', className, ...props }, ref) => {
		return (
			<input
				ref={ref}
				className={cn('input', sizeClassNames[size], className)}
				{...props}
			/>
		);
	},
);

Input.displayName = 'Input';
