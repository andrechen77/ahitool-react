import type React from 'react';
import { cn } from '../../util/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Card({ className, children, ...props }: CardProps) {
	return (
		<div className={cn('card', className)} {...props}>
			{children}
		</div>
	);
}
