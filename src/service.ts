import fetch from 'node-fetch';
import chalk from 'chalk';
import * as emoji from 'node-emoji';
import ora from 'ora';
import AdmZip from 'adm-zip';
import { SERVICE_URL } from './config';

const loading = (message: string) => {
	return ora(message).start();
};

export const getManifest = async () => {
	const errorMessage = chalk.red(
		`${emoji.get('x')} Unable to fetch DappStarter manifest.`
	);
	const spinner = loading('Fetching manifest...');
	try {
		const resp = await fetch(`${SERVICE_URL}/manifest`);

		if (resp.ok) {
			const data = await resp.json();
			return data;
		}
		console.error(errorMessage);
	} catch (error) {
		if (process.env.DAPPSTARTER_DEBUG === 'true') {
			console.error(error);
		}
		spinner.stopAndPersist({
			symbol: chalk.red(emoji.get('heavy_exclamation_mark')),
			text: spinner.text + ' ' + errorMessage,
		});
	} finally {
		spinner.stop();
	}
};
type DappSelections = {
	name: string;
	blocks?: object;
};

export const postSelections = async (
	outputPath: string,
	dappName: string,
	options: any,
	authToken: string
) => {
	let errorMessage = chalk.red(
		`${emoji.get('x')} Unable to process configuration.`
	);
	const spinner = loading('DappStarter complete. Generating project...');
	try {
		let data = { name: dappName } as DappSelections;

		if (options.blockchain != null) {
			data = { ...options, ...data };
		} else {
			data = { blocks: options, ...data };
		}
		const resp = await fetch(`${SERVICE_URL}/process?github=false`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authToken ? `Bearer ${authToken}` : '',
			},
			body: JSON.stringify(data),
		});
		if (resp.ok) {
			let { url } = await resp.json();
			let fileResp = await fetch(url.replace('////', '//'));
			if (fileResp.ok) {
				let zip = new AdmZip(await fileResp.buffer());
				await zip.extractAllToAsync(outputPath);
			}

			spinner.stopAndPersist({
				symbol: emoji.get('100'),
				text: spinner.text + chalk.green(' Done!'),
			});
			return true;
		}
		console.error(errorMessage);
	} catch (error) {
		if (process.env.DAPPSTARTER_DEBUG === 'true') {
			console.error(error);
		}
		spinner.stopAndPersist({
			symbol: chalk.red(emoji.get('heavy_exclamation_mark')),
			text: spinner.text + ' ' + errorMessage,
		});
	} finally {
		spinner.stop();
	}
};
