import chalk from 'chalk';
import { pathExists, remove, readJson } from 'fs-extra';
import got from 'got';
import { REQUEST_TIMEOUT, SERVICE_URL, initPaths } from './constants';
import { generateKeys } from './ssh';
import { homedir } from 'os';
import { join } from 'path';
import loginDialog from './auth';
import { IAuth, isAuthenticated } from './auth';
import { startContainer, stopContainer } from './docker';
import { optionSearch } from './utils';
import { Command } from 'commander';

export async function localAction(command: Command) {
	const inputDirectory = optionSearch<string>(command, 'inputDirectory');
	const { folderPath, homeConfigDir, projectName } =
		initPaths(inputDirectory);
	await startContainer(homeConfigDir, projectName, folderPath);
}

export async function localDownAction(command: Command) {
	const inputDirectory = optionSearch<string>(command, 'inputDirectory');
	const { homeConfigDir } = initPaths(inputDirectory);
	await stopContainer(homeConfigDir);
}

export async function downAction(command: Command) {
	const inputDirectory = optionSearch<string>(command, 'inputDirectory');
	const { projectName } = initPaths(inputDirectory);
	if (!(await isAuthenticated())) {
		await loginDialog();
	}
	let authKey = (
		(await readJson(join(homedir(), '.dappstarter', 'user.json'))) as IAuth
	).id_token;

	try {
		await got(`${SERVICE_URL}/system/stop`, {
			method: 'POST',
			retry: {
				limit: 2,
				methods: ['GET', 'POST'],
			},
			timeout: REQUEST_TIMEOUT,
			headers: {
				Authorization: `bearer ${authKey}`,
			},
			json: {
				projectName,
			},
		});
		console.log(chalk.blueBright(`Remote container has been stopped.`));
	} catch (error) {
		console.error(chalk.red(JSON.stringify(error)));
	}
}
export async function cleanAction(command: Command) {
	const inputDirectory = optionSearch<string>(command, 'inputDirectory');
	const { homeConfigDir, projectName } = initPaths(inputDirectory);
	if (!(await isAuthenticated())) {
		await loginDialog();
	}
	let authKey = (
		(await readJson(join(homedir(), '.dappstarter', 'user.json'))) as IAuth
	).id_token;
	await got(`${SERVICE_URL}/system/clean`, {
		method: 'POST',
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		timeout: REQUEST_TIMEOUT,
		headers: {
			Authorization: `bearer ${authKey}`,
		},
		json: {
			projectName,
		},
	});
	if (pathExists(homeConfigDir)) {
		await remove(homeConfigDir);
	}

	console.log(chalk.blueBright('[CONFIG] Configuration cleaned'));
}

export async function keygen() {
	// Get GeneratedKeys
	const { publicSSH_key } = generateKeys();
	console.log(publicSSH_key);
}

export async function localDevleopment() {}
