import { homedir } from 'os';
import { lookup } from 'dns/promises';
import getPort from 'get-port';
import { basename, join } from 'path';
import {
	ensureDir,
	writeJSON,
	readJSON,
	readJson,
	pathExists,
} from 'fs-extra';
import chalk from 'chalk';
import hash from 'string-hash';
import { connectable, defer, EMPTY, interval, timer } from 'rxjs';
import {
	catchError,
	map,
	mergeAll,
	startWith,
	takeUntil,
	takeWhile,
} from 'rxjs/operators';
import { IAuth } from './auth';
import got from 'got';
import { DevelopConfig } from './types';
import { createKeys, forwardPorts, isSshOpen, remoteConnect } from './ssh';
import { CONFIG_FILE, REQUEST_TIMEOUT, SERVICE_URL } from './constants';
import ora from 'ora';
import * as emoji from 'node-emoji';
import { clean, keygen } from './develop.subcommands';
import humanizer from 'humanize-duration';
import { Command } from 'commander';
import humanizeDuration from 'humanize-duration';
import { setLogLevel, log } from './utils';
import { downloadUnison, syncFilesToRemote } from './unison';

export default async function developCommand(
	subcommand: 'down' | 'cmd' | 'clean' | 'debug' | null,
	subCommandOption:
		| 'down'
		| 'connect'
		| 'keygen'
		| 'forward'
		| 'monitor'
		| 'download'
		| 'unison'
		| 'dns'
		| null,
	options: { inputDirectory: string; debug: boolean },
	command: Command
): Promise<void> {
	let folderPath = options.inputDirectory || process.cwd();
	if (options.debug) {
		setLogLevel(true);
	}
	const startTime = new Date().getTime();
	const rootFolderName = basename(folderPath);
	const hashFolderPath = hash(folderPath);
	const projectName = `${rootFolderName}-${hashFolderPath}`;
	const homeConfigDir = join(homedir(), '.dappstarter', projectName);
	const configFilePath = join(homeConfigDir, CONFIG_FILE);
	const openPort = await getPort();
	let authKey = (
		(await readJson(join(homedir(), '.dappstarter', 'user.json'))) as IAuth
	).id_token;
	if (subcommand === 'clean') {
		await clean({
			homeConfigDir,
			authKey,
			projectName,
		});
		return;
	}
	if (subcommand === 'down') {
		try {
			await stopRemoteContainer(projectName, authKey);
			console.log(chalk.blueBright(`Remote container has been stopped.`));
		} catch (error) {
			console.error(chalk.red(JSON.stringify(error)));
		}

		return;
	}
	if (subcommand === 'debug') {
		if (subCommandOption === 'keygen') {
			keygen();
		} else if (subCommandOption === 'monitor') {
			await monitorContainerStatus(projectName, authKey);
		} else if (subCommandOption === 'forward') {
		} else if (subCommandOption === 'dns') {
			const { privateKey, projectUrl } = await getConfiguration(
				configFilePath
			);
			const dnsResult = await lookup(projectUrl);
			log(dnsResult);
		} else if (subCommandOption === 'download') {
			await downloadUnison();
		} else if (subCommandOption === 'unison') {
			const remoteFolderPath = `ssh://dappstarter@localhost:6000//app`;
			await syncFilesToRemote(
				folderPath,
				remoteFolderPath,
				join(homeConfigDir, 'privatekey')
			);
		}
		return;
	}

	if (!(await pathExists(configFilePath))) {
		try {
			await initialize({
				homeConfigDir,
				folderPath,
				projectName,
				authKey,
				configFilePath,
			});
		} catch (error) {
			console.error('Startup Init Error', error);
		}
	} else {
		await reconnect({
			authKey,
			projectName,
			configFilePath,
			folderPath,
			homeConfigDir,
		});
		// Close process to shutdown all open ports
	}
	process.exit(0);
}

async function initialize({
	homeConfigDir,
	folderPath,
	projectName,
	authKey,
	configFilePath,
}: {
	homeConfigDir: string;
	folderPath: string;
	projectName: string;
	authKey: string;
	configFilePath: string;
}) {
	let startTime = new Date().getTime();
	await ensureDir(homeConfigDir);

	try {
		const { privateKey, publicKey } = await createKeys(homeConfigDir);
		const { projectUrl } = await createRemoteContainer(
			projectName,
			publicKey,
			authKey
		);

		const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;

		await storeConfigurationFile(configFilePath, {
			projectUrl,
			privateKey,
			publicKey,
		});

		if (!(await isSshOpen(projectUrl))) {
			return;
		}

		const syncProcess = syncFilesToRemote(
			folderPath,
			remoteFolderPath,
			privateKey
		);

		await forwardPorts([5000, 5001, 5002], projectUrl, privateKey);

		await pingProject(projectName, authKey);
		console.log(
			chalk.green('[DAPPSTARTER] Connected to dappstarter service')
		);
		log(
			chalk.green(
				`Startup time: ${humanizeDuration(
					new Date().getTime() - startTime
				)}`
			)
		);

		await remoteConnect(projectUrl, privateKey);
	} catch (error) {
		console.error('Startup Init Error', error);
	}
}

async function reconnect({
	configFilePath,
	projectName,
	authKey,
	homeConfigDir,
	folderPath,
}: {
	configFilePath: string;
	projectName: string;
	homeConfigDir: string;
	authKey: string;
	folderPath: string;
}) {
	const { publicKey, privateKey, projectUrl } = await getConfiguration(
		configFilePath
	);

	await createRemoteContainer(projectName, publicKey, authKey);
	if (!(await isSshOpen(projectUrl))) {
		return;
	}
	const remoteFolderPath = `ssh://dappstarter@${projectUrl}:22//app`;
	const syncProcess = syncFilesToRemote(
		folderPath,
		remoteFolderPath,
		join(homeConfigDir, 'privatekey')
	);

	let portsAvailable = await forwardPorts(
		[5000, 5001, 5002],
		projectUrl,
		privateKey
	);

	console.log(
		chalk.green('[DAPPSTARTER] Reconnected to dappstarter service')
	);

	await pingProject(projectName, authKey);
	await remoteConnect(projectUrl, privateKey);

	// Close process to shutdown all open ports
	process.exit(0);
}

async function storeConfigurationFile(filePath: string, config: DevelopConfig) {
	await writeJSON(filePath, config, { spaces: 4 });
	log(chalk.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}

async function getConfiguration(filePath: string): Promise<DevelopConfig> {
	return await readJSON(filePath);
}

async function stopRemoteContainer(projectName: string, authKey: string) {
	const remoteStartResponse = await got(`${SERVICE_URL}/system/stop`, {
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
}

async function createRemoteContainer(
	projectName: string,
	publicKey: string,
	authKey: string
): Promise<{
	remoteApiKey: string;
	projectUrl: string;
}> {
	let startTime = new Date().getTime();
	let text = () =>
		`Creating remote container... ${humanizer(
			new Date().getTime() - startTime,
			{ maxDecimalPoints: 1 }
		)} `;
	let spinner = ora(text()).start();
	let timer = setInterval(() => (spinner.text = text()), 1000);
	const { body } = await got<{
		remoteApiKey: string;
		projectUrl: string;
	}>(`${SERVICE_URL}/system/start`, {
		method: 'POST',
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		headers: {
			Authorization: `bearer ${authKey}`,
		},
		responseType: 'json',
		json: {
			projectName,
			publicKey,
		},
	});
	await monitorContainerStatus(projectName, authKey);
	clearInterval(timer);
	spinner.stopAndPersist({
		symbol: emoji.get('heavy_check_mark'),
		text:
			spinner.text + chalk.green(`Container created: ${body.projectUrl}`),
	});

	return body;
}

async function monitorContainerStatus(projectName: string, authKey: string) {
	let timeout = timer(5 * 60 * 1000);
	await interval(5000)
		.pipe(
			startWith(0),
			map(() =>
				defer(
					async () => await checkContainerStatus(projectName, authKey)
				)
			),
			mergeAll(1),
			takeWhile((x) => {
				return !x;
			}),
			takeUntil(timeout)
		)
		.toPromise();
}

async function checkContainerStatus(
	projectName: string,
	authKey: string
): Promise<boolean> {
	const { body } = await got<{
		status: string;
	}>(`${SERVICE_URL}/system/status`, {
		method: 'GET',
		searchParams: { projectName },
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		headers: {
			Authorization: `bearer ${authKey}`,
		},
		responseType: 'json',
	});
	if (body.status === 'Running') {
		return true;
	}
	return false;
}

async function pingProject(projectName: string, authKey: string) {
	connectable(
		timer(1000).pipe(
			map(() =>
				defer(async () => {
					return await got(`${SERVICE_URL}/system/ping`, {
						method: 'POST',
						headers: {
							Authorization: `bearer ${authKey}`,
							'Content-Type': 'application/json',
						},
						json: {
							projectName,
						},
					});
				}).pipe(catchError((err) => EMPTY))
			),
			mergeAll(1)
		)
	).connect();
}
