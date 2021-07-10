import { homedir } from 'os';
import getPort from 'get-port';
import { basename, join } from 'path';
import { down, exec, upAll } from 'docker-compose';
import {
	ensureDir,
	copyFile,
	writeJSON,
	readJSON,
	readFile,
	writeFile,
	readJson,
	pathExists,
	remove,
	appendFile,
} from 'fs-extra';
import waitOn from 'wait-on';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { parse } from 'fast-xml-parser';
import hash from 'string-hash';
import keypair from 'keypair';
import forge from 'node-forge';
import { Client } from 'ssh2';
import { SSHConnection } from 'node-ssh-forward';
import { connectable, defer, timer } from 'rxjs';
import { map, mergeAll } from 'rxjs/operators';
import { IAuth } from './auth';
import got from 'got';
import polly from 'polly-js';
import { DevelopConfig } from './types';
import { createKeys, forwardRemotePort, remoteConnect } from './ssh';
import { downRemoteDevice, createLocalRemoteDevice, setDefaultSyncOptions, addRemoteDevice, addFolderLocal, acceptLocalDeviceOnRemote, shareRemoteFolder, setupLocalSyncThing } from './syncthing';
import { REQUEST_TIMEOUT } from './constants';

const CONFIG_FILE = 'config.json';
const REMOTE_PORT = '7000';
type actionType = 'down' | 'cmd' | 'remote' | 'clean' | 'misc' | null;
const serviceUrl =
	process.env.DAPPSTARTER_SERVICE_URL ||
	'https://dappstarter-api.decentology.com';

export default async function developCommand(
	action: actionType,
	args: any,
	subcommands: ['down', 'connect', 'keygen', 'forward']
): Promise<void> {
	let folderPath = process.cwd();
	let rootFolderName = basename(folderPath);
	let hashFolderPath = hash(folderPath);
	let projectName = `${rootFolderName}-${hashFolderPath}`;
	let projectUrl = `${projectName}.centralus.azurecontainer.io`;
	let homeConfigDir = join(homedir(), '.dappstarter', projectName);
	let configFilePath = join(homeConfigDir, CONFIG_FILE);
	let authkey = (
		(await readJson(join(homedir(), '.dappstarter', 'user.json'))) as IAuth
	).id_token;
	if (action === 'clean') {
		try {
			await down({
				cwd: homeConfigDir,
				env: {
					DS_SYNCTHING_NAME: rootFolderName,
					DS_APP_ROOT: process.cwd(),
					DS_SYNCTHING_PORT: '0',
				},
			});
		} catch (error) {}

		if (pathExists(homeConfigDir)) {
			await remove(homeConfigDir);
		}
		await cleanRemote(projectName, authkey);

		console.log(chalk.blueBright('[CONFIG] Configuration cleaned'));
		return;
	}
	if (action === 'down') {
		try {
			let { port } = await getConfiguration(configFilePath);
			await down({
				cwd: homeConfigDir,
				env: {
					DS_SYNCTHING_NAME: rootFolderName,
					DS_APP_ROOT: process.cwd(),
					DS_SYNCTHING_PORT: port.toString(),
				},
			});
			await downRemoteDevice();
		} catch (error) {
			console.error(chalk.red(JSON.stringify(error)));
		}

		return;
	} else if (action === 'cmd') {
		let cmd = await exec(
			'syncthing',
			'cat /var/syncthing/config/config.xml',
			{
				cwd: homeConfigDir,
			}
		);

		let config = parse(cmd.out, {
			attrNodeName: '@',
			ignoreAttributes: false,
		});
		let apiKey = config.configuration.gui.apikey;
		console.log(
			JSON.stringify(config.configuration.device['@']['@_id'], null, 2)
		);
		return;
	} else if (action === 'remote') {
		try {
			if (subcommands?.includes('down')) {
				await downRemoteDevice();
			} else if (subcommands?.includes('connect')) {
				let privateKey = (
					await readFile(join(homeConfigDir, 'privatekey'))
				).toString();
				await remoteConnect(projectUrl, privateKey);
				return;
			} else if (subcommands?.includes('keygen')) {
				const { privateKey, publicKey } = await createKeys(
					homeConfigDir
				);
				console.log(chalk.blueBright('[SSH] Public Key ' + publicKey));
				return;
			} else if (subcommands?.includes('forward')) {
				await forwardRemotePort({
					port: 7000,
					remotePort: 8384,
					configPath: configFilePath,
					projectUrl:
						'dappstarter-cli-node-2207694351.centralus.azurecontainer.io',
				});
				console.log('Ending port forward');
				return;
			} else {
				let result = await createLocalRemoteDevice();
				console.log(result);
			}
		} catch (error) {
			console.log(error);
		}
		return;
	} else if (action === 'misc') {
		const { port, apiKey, remoteApiKey, remoteDeviceId, deviceId } =
			await getConfiguration(configFilePath);
		const openPort = port.toString();
		await forwardRemotePort({
			port: parseInt(REMOTE_PORT),
			remotePort: 8384,
			configPath: configFilePath,
			projectUrl,
		});
		await forwardRemotePort({
			port: 22000,
			configPath: configFilePath,
			projectUrl,
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

		await acceptLocalDeviceOnRemote(REMOTE_PORT, remoteApiKey, deviceId);

		await shareRemoteFolder(REMOTE_PORT, remoteApiKey, deviceId);

		console.log(chalk.blueBright('[SYNC] Complete'));
		return;
	}

	if (!(await pathExists(configFilePath))) {
		await ensureDir(homeConfigDir);
		await copyFile(
			'./templates/docker-compose.yml',
			join(homeConfigDir, 'docker-compose.yml')
		);
		let openPort = (await getPort()).toString();

		try {
			await upAll({
				cwd: homeConfigDir,
				env: {
					DS_SYNCTHING_NAME: rootFolderName,
					DS_APP_ROOT: process.cwd(),
					DS_SYNCTHING_PORT: openPort,
				},
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
				rootFolderName,
				openPort
			);
			const { privateKey, publicKey } = await createKeys(homeConfigDir);

			// const { apiKey: remoteApiKey, deviceId: remoteDeviceId } =
			// 	await createLocalRemoteDevice();
			const { remoteApiKey, remoteDeviceId } = await createRemoteDevice(
				projectName,
				publicKey,
				authkey
			);

			console.log(
				chalk.blueBright(`[SYNC] Remote API Key ${remoteApiKey}`)
			);
			console.log(
				chalk.blueBright(`[SYNC] Remote Device ID ${remoteDeviceId}`)
			);
			console.log(
				chalk.blueBright(
					`[SYNC] Remote process started listening on http://localhost:${REMOTE_PORT}`
				)
			);

			await storeConfigurationFile(configFilePath, {
				deviceId,
				apiKey,
				remoteApiKey,
				remoteDeviceId,
				port: parseInt(openPort),
				privateKey,
				publicKey,
			});

			await forwardRemotePort({
				port: parseInt(REMOTE_PORT),
				remotePort: 8384,
				configPath: configFilePath,
				projectUrl,
			});
			await forwardRemotePort({
				port: 22000,
				configPath: configFilePath,
				projectUrl,
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
				remoteApiKey,
				deviceId
			);
			await shareRemoteFolder(REMOTE_PORT, remoteApiKey, deviceId);

			console.log(
				chalk.blueBright(`[SYNC] Added local and remote folder`)
			);

			await remoteConnect(projectUrl, privateKey);

			console.log(
				chalk.blueBright('[SYNC] Remote Api Key ' + remoteApiKey)
			);
			console.log(
				chalk.blueBright('[SYNC] Remote Device ID ' + remoteDeviceId)
			);
		} catch (error) {
			console.error('Error', error);
		}
	} else {
		await forwardRemotePort({
			port: parseInt(REMOTE_PORT),
			remotePort: 8384,
			configPath: configFilePath,
			projectUrl,
		});
		await forwardRemotePort({
			port: 22000,
			configPath: configFilePath,
			projectUrl,
		});
		// Container already exists
		const config = await getConfiguration(configFilePath);
		console.log(chalk.blueBright('[SYNC] Remote container started'));
		// await forwardRemotePort({
		// 	port: parseInt(REMOTE_PORT),
		// 	remotePort: 8384,
		// 	configPath: configFilePath,
		// 	projectUrl,
		// });

		console.log(chalk.blueBright('[SYNC] Reconnected to sync service'));
		await remoteConnect(projectUrl, config.privateKey);
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

async function cleanRemote(projectName: string, authKey: string) {
	const remoteStartResponse = await fetch(
		`${serviceUrl}/system/remote/clean`,
		{
			method: 'POST',
			headers: {
				Authorization: `bearer ${authKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				projectName,
			}),
		}
	);
}

async function stopRemoteDevice(projectName: string, authKey: string) {
	const remoteStartResponse = await got(`${serviceUrl}/remote/stop`, {
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

async function createRemoteDevice(
	projectName: string,
	publicKey: string,
	authKey: string
): Promise<{ remoteDeviceId: string; remoteApiKey: string }> {
	const { body } = await got<{
		remoteDeviceId: string;
		remoteApiKey: string;
	}>(`${serviceUrl}/system/remote/start`, {
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

	return body;
	/** TODO
	 * I need the following
	 * - DeviceId (SyncThing)
	 * - Project URL (which I can obtain locally technically with the projet name)
	 * - GUI
	 */
}

async function pingProject(projectName: string, authKey: string) {
	await connectable(
		timer(60 * 1000).pipe(
			map(() =>
				defer(async () => {
					return await got(`${serviceUrl}/remote/ping`, {
						method: 'POST',
						headers: {
							Authorization: `bearer ${authKey}`,
							'Content-Type': 'application/json',
						},
						json: {
							projectName,
						},
					});
				})
			),
			mergeAll(1)
		)
	).connect();
}





