import chalk from 'chalk';
import { down } from 'docker-compose';
import { pathExists, remove } from 'fs-extra';
import got from 'got';
import { SERVICE_URL } from './constants';
import { createKeys, generateKeys } from './ssh';

export async function clean({
	homeConfigDir,
	rootFolderName,
	projectName,
	authKey,
	folderPath,
	port,
	syncPort,
}: {
	homeConfigDir: string;
	rootFolderName: string;
	projectName: string;
	authKey: string;
	folderPath: string;
	port: number;
	syncPort: number;
}) {
	try {
		await down({
			cwd: homeConfigDir,
			env: {
				DS_SYNCTHING_NAME: rootFolderName,
				DS_APP_ROOT: folderPath,
				DS_SYNCTHING_PORT: port.toString(),
				DS_SYNCTHING_CONNECTION: syncPort.toString(),
			},
		});
	} catch (error) {}

	await cleanRemote(projectName, authKey);
	if (pathExists(homeConfigDir)) {
		await remove(homeConfigDir);
	}

	console.log(chalk.blueBright('[CONFIG] Configuration cleaned'));
}
async function cleanRemote(projectName: string, authKey: string) {
	const remoteStartResponse = await got(
		`${SERVICE_URL}/system/clean`,
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

export async function keygen() {
	// Get GeneratedKeys
	const { privateSSH_key, publicSSH_key } = generateKeys();
	console.log(publicSSH_key);
}
