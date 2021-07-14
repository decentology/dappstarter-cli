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
}: {
	homeConfigDir: string;
	rootFolderName: string;
	projectName: string;
	authKey: string;
}) {
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
	await cleanRemote(projectName, authKey);

	console.log(chalk.blueBright('[CONFIG] Configuration cleaned'));
}
async function cleanRemote(projectName: string, authKey: string) {
	const remoteStartResponse = await got(
		`${SERVICE_URL}/system/remote/clean`,
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
