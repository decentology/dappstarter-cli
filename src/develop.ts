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
const CONFIG_FILE = 'config.json';
const REMOTE_PORT = '7000';
type actionType = 'down' | 'cmd' | 'remote' | null;
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
	let homeConfigDir = join(homedir(), '.dappstarter', projectName);
	let configFilePath = join(homeConfigDir, CONFIG_FILE);
	let authkey = ((await readJson(join(homedir(), 'user.json'))) as IAuth)
		.id_token;
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
				await remoteConnect(configFilePath);
				return;
			} else if (subcommands?.includes('keygen')) {
				let pemKey = ((await readJSON(configFilePath)) as DevelopConfig)
					.publicKey;
				let privatePemKey = (
					(await readJSON(configFilePath)) as DevelopConfig
				).privateKey;
				let publicKey = forge.pki.publicKeyFromPem(pemKey);
				let privateKey = forge.pki.privateKeyFromPem(privatePemKey);
				let sshKey = forge.ssh.publicKeyToOpenSSH(
					publicKey,
					'dappstarter@localhost'
				);
				await writeFile(join(homeConfigDir, 'publickey'), sshKey);
				await writeFile(
					join(homeConfigDir, 'privatekey'),
					forge.ssh.privateKeyToOpenSSH(privateKey)
				);
				console.log(chalk.blueBright('[SSH] Public Key ' + sshKey));
				return;
			} else if (subcommands?.includes('forward')) {
				await forwardRemotePorts2(
					configFilePath,
					'dappstarter-cli-node-2207694351.northcentralus.azurecontainer.io'
				);
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
	}

	await ensureDir(homeConfigDir);
	await copyFile(
		'./templates/docker-compose.yml',
		join(homeConfigDir, 'docker-compose.yml')
	);
	let openPort = (await getPort()).toString();
	let { private: privateKey, public: publicKey } = keypair();

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
		await storeConfigurationFile(configFilePath, {
			deviceId,
			apiKey,
			port: parseInt(openPort),
			privateKey,
			publicKey,
		});
		const { apiKey: remoteApiKey, deviceId: remoteDeviceId } =
			await createLocalRemoteDevice();
		console.log(
			chalk.blueBright(
				`[SYNC] Remote process started listening on http://localhost:${REMOTE_PORT}`
			)
		);

		await setDefaultSyncOptions(openPort, apiKey);
		await setDefaultSyncOptions(REMOTE_PORT, remoteApiKey);

		await addRemoteDevice(openPort, apiKey, remoteDeviceId);
		await addFolderLocal(openPort, apiKey, deviceId, remoteDeviceId);

		await createRemoteDevice(projectName, publicKey, authkey);

		await acceptLocalDeviceOnRemote(REMOTE_PORT, remoteApiKey, deviceId);
		await shareRemoteFolder(REMOTE_PORT, remoteApiKey, deviceId);

		console.log(chalk.blueBright('[SYNC] Remote Api Key ' + remoteApiKey));
		console.log(
			chalk.blueBright('[SYNC] Remote Device ID ' + remoteDeviceId)
		);
	} catch (error) {
		console.error('Error', error);
	}
}

type DevelopConfig = {
	deviceId: string;
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
		await removeDefaultFolderShare(port, apiKey);
		return {
			apiKey,
			deviceId,
		};
	} catch (error) {
		console.log(error);
	}
}

async function setDefaultSyncOptions(port: string, apiKey: string) {
	await fetch(`http://localhost:${port}/rest/config/options`, {
		method: 'PATCH',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			urAccepted: -1,
			urSeen: 3,
		}),
	});
	await fetch(`http://localhost:${port}/rest/config/gui`, {
		method: 'PATCH',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			user: 'dappstarter',
			password: 'sample',
			theme: 'dark',
		}),
	});
}

async function addFolderLocal(
	port: string,
	apiKey: string,
	deviceId: string,
	remoteDeviceId: string
) {
	await fetch(`http://localhost:${port}/rest/config/folders`, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			id: '1',
			path: '/app',
			rescanIntervalS: 3600,
			fsWatcherEnabled: true,
			fsWatcherDelayS: 1,
			devices: [{ deviceID: deviceId }, { deviceID: remoteDeviceId }],
		}),
	});
}

async function removeDefaultFolderShare(port: string, apiKey: string) {
	await fetch(`http://localhost:${port}/rest/config/folders/default`, {
		method: 'DELETE',
		headers: {
			'x-api-key': apiKey,
		},
	});
}

async function addRemoteDevice(port: string, apiKey: string, deviceId: string) {
	await fetch(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			name: 'remote',
			deviceID: deviceId,
			addresses: [
				'tcp://dappstarter-host:22000',
				'quic://dappstarter-host:22000',
			],
		}),
	});
}

async function acceptLocalDeviceOnRemote(
	port: string,
	apiKey: string,
	deviceId: string
) {
	await fetch(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			name: 'local',
			deviceID: deviceId,
		}),
	});
}

async function shareRemoteFolder(
	port: string,
	apiKey: string,
	deviceId: string
) {
	await fetch(`http://localhost:${port}/rest/config/folders`, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			id: '1',
			path: '/var/syncthing/1',
			rescanIntervalS: 3600,
			fsWatcherEnabled: true,
			fsWatcherDelayS: 1,
			devices: [{ deviceID: deviceId }],
		}),
	});
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
	const remoteStartResponse = await fetch(`${serviceUrl}/remote/stop`, {
		method: 'POST',
		headers: {
			Authorization: `bearer ${authKey}`,
		},
		body: JSON.stringify({
			projectName,
		}),
	});
}

async function createRemoteDevice(
	projectName: string,
	publicKey: string,
	authKey: string
) {
	const remoteStartResponse = await fetch(`${serviceUrl}/remote/start`, {
		method: 'POST',
		headers: {
			Authorization: `bearer ${authKey}`,
		},
		body: JSON.stringify({
			projectName,
			publicKey,
		}),
	});
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
					return await fetch(`${serviceUrl}/remote/ping`, {
						method: 'POST',
						headers: {
							Authorization: `bearer ${authKey}`,
						},
						body: JSON.stringify({
							projectName,
						}),
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
async function remoteConnect(configPath: string): Promise<void> {
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
			host: 'localhost',
			port: 6000,
			username: 'dappstarter',
			privateKey: ((await readJSON(configPath)) as DevelopConfig)
				.privateKey,
		});
	});
}

async function forwardRemotePorts2(configPath: string, projectUrl: string) {
	return new Promise(async (resolve) => {
		const sshConnection = new SSHConnection({
			endHost: projectUrl,
			privateKey: ((await readJson(configPath)) as DevelopConfig)
				.privateKey,
			username: 'dappstarter',
			endPort: 22,
		});

		await sshConnection.forward({
			fromPort: 7000,
			toPort: 5002,
		});
		resolve(sshConnection);
	});
}

async function forwardRemotePorts(
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
