import chalk from "chalk";
import { join } from 'path';
import { down, exec, upAll } from "docker-compose";
import got from "got";
import { REQUEST_TIMEOUT } from "./constants";
import { parse } from "fast-xml-parser";
import { readFile } from "fs-extra";
import waitOn from "wait-on";

export async function shareRemoteFolder(
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
		timeout: REQUEST_TIMEOUT,
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

export async function downLocalRemoteDevice() {
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

export async function downLocalDevice(homeConfigDir: string, rootFolderName: string, port: number) {
	await down({
		cwd: homeConfigDir,
		env: {
			DS_SYNCTHING_NAME: rootFolderName,
			DS_APP_ROOT: process.cwd(),
			DS_SYNCTHING_PORT: port.toString(),
		},
	});
}

export async function setupLocalSyncThing(
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

export async function setDefaultSyncOptions(port: string, apiKey: string) {
	await removeDefaultFolderShare(port, apiKey);
	let optionsUpdate = await got(
		`http://localhost:${port}/rest/config/options`,
		{
			method: 'PATCH',
			timeout: REQUEST_TIMEOUT,
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
			timeout: REQUEST_TIMEOUT,
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

export async function addFolderLocal(
	port: string,
	apiKey: string,
	deviceId: string,
	remoteDeviceId: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/folders`, {
		method: 'POST',
		timeout: REQUEST_TIMEOUT,
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

export async function removeDefaultFolderShare(port: string, apiKey: string) {
	let resp = await got(
		`http://localhost:${port}/rest/config/folders/default`,
		{
			method: 'DELETE',
			timeout: REQUEST_TIMEOUT,
			headers: {
				'x-api-key': apiKey,
			},
		}
	);

	if (!resp.complete) {
		throw new Error('Unable to remove default folder share');
	}
}

export async function addRemoteDevice(
	port: string,
	apiKey: string,
	deviceId: string,
	projectUrl: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		timeout: REQUEST_TIMEOUT,
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

export async function acceptLocalDeviceOnRemote(
	port: string,
	apiKey: string,
	deviceId: string
) {
	let resp = await got(`http://localhost:${port}/rest/config/devices`, {
		method: 'POST',
		timeout: REQUEST_TIMEOUT,
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

export async function createLocalRemoteDevice() {
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
