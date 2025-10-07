import React from 'react';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { ToastProvider } from '../src/context/ToastContext';

export const parameters = { actions: { argTypesRegex: '^on[A-Z].*' } };

export const decorators = [
	(Story) => (
		<ThemeProvider>
			<ToastProvider>
				<div style={{padding:16, background:'var(--bg)', color:'var(--fg)'}}>
					<Story />
				</div>
			</ToastProvider>
		</ThemeProvider>
	)
];
