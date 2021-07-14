import { homedir } from 'os';
import { lookup } from 'dns/promises';
import getPort from 'get-port';
import { basename, join } from 'path';
import { down, upAll } from 'docker-compose';
import {
	ensureDir,
	copyFile,
	writeJSON,
	readJSON,
	readJson,
	pathExists,
	remove,
} from 'fs-extra';
import waitOn from 'wait-on';
import chalk from 'chalk';
import fetch from 'node-fetch';
import hash from 'string-hash';
import { connectable, defer, EMPTY, interval, timer } from 'rxjs';
import {
	catchError,
	count,
	map,
	mergeAll,
	startWith,
	takeUntil,
	takeWhile,
} from 'rxjs/operators';
import { IAuth } from './auth';
import got from 'got';
import { DevelopConfig } from './types';
import {
	createKeys,
	forwardPorts,
	forwardRemotePort,
	remoteConnect,
} from './ssh';
import {
	downLocalRemoteDevice,
	setDefaultSyncOptions,
	addRemoteDevice,
	addFolderLocal,
	acceptLocalDeviceOnRemote,
	shareRemoteFolder,
	setupLocalSyncThing,
	downLocalDevice,
	getRemoteDeviceId,
	DockerEnv,
} from './syncthing';
import {
	CONFIG_FILE,
	REMOTE_PORT,
	REQUEST_TIMEOUT,
	SERVICE_URL,
} from './constants';
import ora from 'ora';
import * as emoji from 'node-emoji';
import { clean, keygen } from './develop.subcommands';
import humanizer from 'humanize-duration';
import { Command } from 'commander';

export default async function developCommand(
	subcommand: 'down' | 'cmd' | 'clean' | 'debug' | null,
	subCommandOption:
		| 'down'
		| 'connect'
		| 'keygen'
		| 'forward'
		| 'monitor'
		| 'dns'
		| null,
	options: { inputDirectory: string },
	command: Command
): Promise<void> {
	// let folderPath = inputDirectory || process.cwd();
	let folderPath = process.cwd();
	let rootFolderName = basename(folderPath);
	let hashFolderPath = hash(folderPath);
	let projectName = `${rootFolderName}-${hashFolderPath}`;
	let homeConfigDir = join(homedir(), '.dappstarter', projectName);
	let configFilePath = join(homeConfigDir, CONFIG_FILE);
	let authKey = (
		(await readJson(join(homedir(), '.dappstarter', 'user.json'))) as IAuth
	).id_token;
	if (subcommand === 'clean') {
		await clean({
			homeConfigDir,
			authKey,
			projectName,
			rootFolderName,
		});
		return;
	}
	if (subcommand === 'down') {
		try {
			const { port, syncPort } = await getConfiguration(configFilePath);

			const dockerEnv: DockerEnv = {
				DS_SYNCTHING_NAME: rootFolderName,
				DS_APP_ROOT: folderPath,
				DS_SYNCTHING_PORT: port.toString(),
				DS_SYNCTHING_CONNECTION: syncPort.toString(),
			};
			await downLocalDevice(homeConfigDir, dockerEnv);
			await downLocalRemoteDevice();
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
			const { privateKey, projectUrl } = await getConfiguration(
				configFilePath
			);
			await forwardPorts(
				[{ localPort: parseInt(REMOTE_PORT), remotePort: 8384 }],
				projectUrl,
				privateKey
			);
		} else if (subCommandOption === 'dns') {
			const { privateKey, projectUrl } = await getConfiguration(
				configFilePath
			);
			const dnsResult = await lookup(projectUrl);
			console.log(dnsResult);
		}
		return;
	}

	if (!(await pathExists(configFilePath))) {
		await ensureDir(homeConfigDir);
		await copyFile(
			'./templates/docker-compose.yml',
			join(homeConfigDir, 'docker-compose.yml')
		);
		const openPort = (await getPort()).toString();
		const syncPort = (await getPort()).toString();
		const dockerEnv: DockerEnv = {
			DS_SYNCTHING_NAME: rootFolderName,
			DS_APP_ROOT: folderPath,
			DS_SYNCTHING_PORT: openPort,
			DS_SYNCTHING_CONNECTION: syncPort,
		};

		try {
			await upAll({
				cwd: homeConfigDir,
				env: dockerEnv,
			});
			await waitOn({
				resources: [`http://localhost:${openPort}/rest/system/ping`],
				validateStatus(status) {
					return status === 403;
				},
			});
			console.log(
				chalk.blueBright(
					`[SYNC] Local Process started listening on http://localhost:${openPort}`
				)
			);
			let { apiKey, deviceId } = await setupLocalSyncThing(
				homeConfigDir,
				dockerEnv
			);
			const { privateKey, publicKey } = await createKeys(homeConfigDir);

			// const { apiKey: remoteApiKey, deviceId: remoteDeviceId } =
			// 	await createLocalRemoteDevice();
			const { remoteApiKey, projectUrl } = await createRemoteContainer(
				projectName,
				publicKey,
				authKey
			);

			console.log(
				chalk.blueBright(`[SYNC] Remote API Key ${remoteApiKey}`)
			);

			await storeConfigurationFile(configFilePath, {
				projectUrl,
				deviceId,
				apiKey,
				remoteApiKey,
				remoteDeviceId: '',
				port: parseInt(openPort),
				syncPort: parseInt(syncPort),
				privateKey,
				publicKey,
			});

			await forwardRemotePort({
				port: parseInt(REMOTE_PORT),
				remotePort: 8384,
				host: projectUrl,
				privateKey,
			});
			await forwardRemotePort({
				port: 22000,
				host: projectUrl,
				privateKey,
			});
			console.log(
				chalk.blueBright(
					`[SYNC] Remote process started listening on http://localhost:${REMOTE_PORT}`
				)
			);

			const remoteDeviceId = await getRemoteDeviceId(
				REMOTE_PORT,
				remoteApiKey
			);

			await storeConfigurationFile(configFilePath, {
				projectUrl,
				deviceId,
				apiKey,
				remoteApiKey,
				remoteDeviceId,
				port: parseInt(openPort),
				syncPort: parseInt(syncPort),
				privateKey,
				publicKey,
			});

			console.log(
				chalk.blueBright(
					`[SSH] Forwarding port ${REMOTE_PORT} to remote container`
				)
			);

			await setDefaultSyncOptions(openPort, apiKey);
			await setDefaultSyncOptions(REMOTE_PORT, remoteApiKey);

			console.log(
				chalk.blueBright(
					`[SYNC] Default sync configurations for local and remote complete`
				)
			);
			await addRemoteDevice(openPort, apiKey, remoteDeviceId, projectUrl);
			await addFolderLocal(openPort, apiKey, deviceId, remoteDeviceId);

			await acceptLocalDeviceOnRemote(
				REMOTE_PORT,
				syncPort,
				remoteApiKey,
				deviceId
			);
			await shareRemoteFolder(REMOTE_PORT, remoteApiKey, deviceId);

			console.log(
				chalk.blueBright(`[SYNC] Added local and remote folder`)
			);
			await forwardPorts([5000], projectUrl, privateKey);
			await pingProject(projectName, authKey);
			await remoteConnect(projectUrl, privateKey);
			process.exit(0);
		} catch (error) {
			console.error('Error', error);
		}
	} else {
		const { privateKey, projectUrl } = await getConfiguration(
			configFilePath
		);

		console.log(chalk.blueBright('[SYNC] Remote container started'));
		await forwardRemotePort({
			port: parseInt(REMOTE_PORT),
			remotePort: 8384,
			host: projectUrl,
			privateKey,
		});
		await forwardRemotePort({
			port: 22000,
			host: projectUrl,
			privateKey,
		});

		await forwardPorts([5000], projectUrl, privateKey);

		console.log(chalk.blueBright('[SYNC] Reconnected to sync service'));

		// TODO: Restart container

		await pingProject(projectName, authKey);
		await remoteConnect(projectUrl, privateKey);

		// Close process to shutdown all open ports
		process.exit(0);
	}
}

async function storeConfigurationFile(filePath: string, config: DevelopConfig) {
	await writeJSON(filePath, config, { spaces: 4 });
	console.log(
		chalk.blueBright('[CONFIG] Configuration file saved: ' + filePath)
	);
}

async function getConfiguration(filePath: string): Promise<DevelopConfig> {
	return await readJSON(filePath);
}

async function stopRemoteContainer(projectName: string, authKey: string) {
	const remoteStartResponse = await got(`${SERVICE_URL}/remote/stop`, {
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
	}>(`${SERVICE_URL}/system/remote/start`, {
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

	console.log(chalk.blueBright('[SYNC] Container status: RUNNING'));
}

async function checkContainerStatus(
	projectName: string,
	authKey: string
): Promise<boolean> {
	const { body } = await got<{
		status: string;
	}>(`${SERVICE_URL}/system/remote/status`, {
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
					return await got(`${SERVICE_URL}/system/remote/ping`, {
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