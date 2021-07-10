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
import got from 'got/dist/source';
import polly from 'polly-js';

const CONFIG_FILE = 'config.json';
const REMOTE_PORT = '7000';
const requestTimeout: number = 10 * 1000;
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

type DevelopConfig = {
	deviceId: string;
	remoteApiKey: string;
	remoteDeviceId: string;
	apiKey: string;
	port: number;
	privateKey: string;
	publicKey: string;
};

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

async function createKeys(homeConfigDir: string) {
	const { private: privatePemKey, public: publicPemKey } = keypair();
	let publicKey = forge.pki.publicKeyFromPem(publicPemKey);
	let privateKey = forge.pki.privateKeyFromPem(privatePemKey);
	let publicSSH_key = forge.ssh.publicKeyToOpenSSH(
		publicKey,
		'dappstarter@localhost'
	);
	let privateSSH_key = forge.ssh.privateKeyToOpenSSH(privateKey);
	await writeFile(join(homeConfigDir, 'publickey'), publicSSH_key);
	await writeFile(join(homeConfigDir, 'privatekey'), privateSSH_key);

	return {
		privateKey: privateSSH_key,
		publicKey: publicSSH_key,
	};
}

async function setupLocalSyncThing(
	directory: string,
	name: string,
	port: string
) {
	try {
		let cmd = await exec(
			'syncthing',
			'cat /var/syncthing/config/config.xml',
			{
				cwd: directory,
				env: {
					DS_SYNCTHING_NAME: name,
					DS_APP_ROOT: process.cwd(),
					DS_SYNCTHING_PORT: port,
				},
			}
		);

		let config = parse(cmd.out, {
			attrNodeName: '@',
			ignoreAttributes: false,
		});
		let apiKey = config.configuration.gui.apikey;
		let deviceId = config.configuration.device['@']['@_id'];
		console.log(chalk.blueBright(`[SYNC] API ${apiKey}`));
		console.log(chalk.blueBright(`[SYNC] Device ID ${deviceId}`));
		return {
			apiKey,
			deviceId,
		};
	} catch (error) {
		console.log(error);
	}
}

async function setDefaultSyncOptions(port: string, apiKey: string) {
	await removeDefaultFolderShare(port, apiKey);
	let optionsUpdate = await got(
		`http://localhost:${port}/rest/config/options`,
		{
			method: 'PATCH',
			timeout: requestTimeout,
			headers: {
				'x-api-key': apiKey,
			},
			json: {
				urAccepted: -1,
				urSeen: 3,
				relaysEnabled: false,
				reconnectionIntervalS: 1,
				progressUpdateIntervalS: 1,
				startBrowser: false,
				globalAnnounceEnabled: false,
				localAnnounceEnabled: false,
				autoUpgradeIntervalH: 0,
				natEnabled: false,
				crashReportingEnabled: false,
				setLowPriority: false,
			},
		}
	);
	if (!optionsUpdate.complete) {
		throw new Error('Unable to set default configuration');
	}
	try {
		let guiUpdate = await got(`http://localhost:${port}/rest/config/gui`, {
			method: 'PATCH',
			timeout: requestTimeout,
			headers: {
				'x-api-key': apiKey,
			},
			json: {
				address: '0.0.0.0:8384',
				user: 'dappstarter',
				password: 'sample',
				theme: 'dark',
			},
		});
		if (!guiUpdate.complete) {
			throw new Error('Unable to set login credentials on remote');
		}
	} catch (error) {}

	console.log(
		chalk.blueBright(`[SYNC] Default sync options set for port ${port}`)
	);
}

async function addFolderLocal(
	port: string,
	apiKey: string,
	deviceId: string,
	remoteDeviceId: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/folders`, {
		method: 'POST',
		timeout: requestTimeout,
		headers: {
			'x-api-key': apiKey,
		},
		json: {
			id: '1',
			path: '/app',
			rescanIntervalS: 3600,
			fsWatcherEnabled: true,
			fsWatcherDelayS: 1,
			devices: [{ deviceID: deviceId }, { deviceID: remoteDeviceId }],
		},
	});
	if (!resp.complete) {
		throw new Error('Unable to add local folder');
	}
	console.log(chalk.blueBright(`[SYNC] Added local folder to sync`));
}

async function removeDefaultFolderShare(port: string, apiKey: string) {
	let resp = await got(
		`http://localhost:${port}/rest/config/folders/default`,
		{
			method: 'DELETE',
			timeout: requestTimeout,
			headers: {
				'x-api-key': apiKey,
			},
		}
	);

	if (!resp.complete) {
		throw new Error('Unable to remove default folder share');
	}
}

async function addRemoteDevice(
	port: string,
	apiKey: string,
	deviceId: string,
	projectUrl: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		timeout: requestTimeout,
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		json: {
			name: 'remote',
			deviceID: deviceId,
			autoAcceptFolders: true,
			addresses: [
				`tcp://${projectUrl}:22000`,
				`quic://${projectUrl}:22000`,
			],
		},
	});
	if (!resp.complete) {
		throw new Error('Unable to add remote device');
	}
	console.log(chalk.blueBright(`[SYNC] Finished adding remote device`));
}

async function acceptLocalDeviceOnRemote(
	port: string,
	apiKey: string,
	deviceId: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		timeout: requestTimeout,
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		json: {
			name: 'local',
			deviceID: deviceId,
			addresses: [`tcp://localhost:22001`, `quic://localhost:22001`],
		},
	});
	if (!resp.complete) {
		throw new Error('Unable to accept local device on remote');
	}

	console.log(chalk.blueBright(`[SYNC] Accepted local device on remote`));
}

async function shareRemoteFolder(
	port: string,
	apiKey: string,
	deviceId: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/folders`, {
		method: 'POST',
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		timeout: requestTimeout,
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		json: {
			id: '1',
			path: '/app',
			rescanIntervalS: 3600,
			fsWatcherEnabled: true,
			fsWatcherDelayS: 1,
			devices: [{ deviceID: deviceId }],
		},
	});
	if (!resp.complete) {
		throw new Error('Unable to share folder');
	}
	console.log(chalk.blueBright(`[SYNC] Accepted local folder on remote`));
}

async function downRemoteDevice() {
	let name = 'dappstarter-host';
	let port = '7000';
	await down({
		// configAsString: dockerConfig,
		cwd: join(process.cwd(), 'templates'),
		config: ['docker-compose.host.yml'],
		env: {
			DS_SYNCTHING_NAME: name,
			DS_SYNCTHING_PORT: port,
		},
	});
}

async function stopRemoteDevice(projectName: string, authKey: string) {
	const remoteStartResponse = await got(`${serviceUrl}/remote/stop`, {
		method: 'POST',
		retry: {
			limit: 2,
			methods: ['GET', 'POST'],
		},
		timeout: requestTimeout,
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

async function createLocalRemoteDevice() {
	let name = 'dappstarter-host';
	let port = '7000';
	const dockerConfig = (
		await readFile(
			join(process.cwd(), 'templates/docker-compose.host.yml'),
			'UTF-8'
		)
	).toString();
	await upAll({
		// configAsString: dockerConfig,
		cwd: join(process.cwd(), 'templates'),
		config: ['docker-compose.host.yml'],
		env: {
			DS_SYNCTHING_NAME: name,
			DS_SYNCTHING_PORT: port,
		},
	});
	await waitOn({
		resources: [`http://localhost:${7000}/rest/system/ping`],
		validateStatus(status) {
			return status === 403;
		},
	});
	let cmd = await exec('syncthing', 'cat /var/syncthing/config/config.xml', {
		cwd: join(process.cwd(), 'templates'),
		config: ['docker-compose.host.yml'],
		env: {
			DS_SYNCTHING_NAME: name,
			DS_APP_ROOT: process.cwd(),
			DS_SYNCTHING_PORT: port,
		},
	});

	let config = parse(cmd.out, {
		attrNodeName: '@',
		ignoreAttributes: false,
	});
	let apiKey = config.configuration.gui.apikey;
	let deviceId = config.configuration.device['@']['@_id'];
	removeDefaultFolderShare(port, apiKey);
	return {
		apiKey,
		deviceId,
	};
}
async function remoteConnect(
	projectUrl: string,
	privateKey: string
): Promise<void> {
	return new Promise(async (resolve) => {
		const conn = new Client();
		conn.on('ready', function () {
			console.log('Client :: ready');
			conn.shell(
				{
					term: process.env.TERM,
					rows: process.stdout.rows,
					cols: process.stdout.columns,
				},
				function (err, stream) {
					if (err) throw err;

					stream.on('close', () => {
						// Don't let process.stdin keep process alive since we no longer need it
						process.stdin.unref();

						conn.end();
						resolve();
						process.exit(0);
					});

					stream.on('exit', () => {
						conn.end();
						resolve();
						process.exit(0);
					});

					// Connect local stdin to remote stdin
					process.stdin.setRawMode(true);
					process.stdin.pipe(stream);

					// Connect remote output to local stdout
					stream.pipe(process.stdout);
					process.stdout.on('resize', () => {
						// Let the remote end know when the local terminal has been resized
						stream.setWindow(
							process.stdout.rows,
							process.stdout.columns,
							0,
							0
						);
					});
				}
			);
		}).connect({
			host: projectUrl,
			port: 22,
			username: 'dappstarter',
			privateKey: privateKey,
			keepaliveCountMax: 10,
			keepaliveInterval: 5000,
			// debug: async (msg) => {
			// 	await appendFile('log.txt', msg + '\n');
			// },
		});
	});
}

async function forwardRemotePort({
	port,
	remotePort,
	configPath,
	projectUrl,
}: {
	port: number;
	remotePort?: number;
	configPath: string;
	projectUrl: string;
}) {
	return polly()
		.waitAndRetry(5)
		.executeForPromise(async () => {
			return new Promise(async (resolve) => {
				const sshConnection = new SSHConnection({
					endHost: projectUrl,
					privateKey: ((await readJson(configPath)) as DevelopConfig)
						.privateKey,
					username: 'dappstarter',
					endPort: 22,
				});

				await sshConnection.forward({
					fromPort: port,
					toPort: remotePort || port,
				});
				resolve(sshConnection);
			});
		});
}

async function forwardRemotePorts_old(
	configPath: string,
	projectUrl: string
): Promise<void> {
	return new Promise(async (resolve) => {
		const conn = new Client();
		try {
			conn.on('ready', () => {
				console.log('Client :: ready');
				conn.forwardOut(
					projectUrl,
					7000,
					'localhost',
					5002,
					(err, stream) => {
						if (err) throw err;
						stream
							.on('close', () => {
								console.log('TCP :: CLOSED');
								process.stdin.unref();
								conn.end();
								resolve();
							})
							.on('data', (data: string) => {
								console.log('TCP :: DATA: ' + data);
							});
					}
				);
			}).connect({
				host: projectUrl,
				port: 22,
				username: 'dappstarter',
				privateKey: ((await readJson(configPath)) as DevelopConfig)
					.privateKey,
			});
		} catch (error) {
			console.error(error);
		}
	});
}
