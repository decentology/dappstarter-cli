import chalk from 'chalk';
import { pathExists, remove } from 'fs-extra';
import { generateKeys } from './ssh';

export async function clean({
	homeConfigDir,
	projectName,
	authKey,
}: {
	homeConfigDir: string;
	projectName: string;
	authKey: string;
}) {
	await cleanRemote(projectName, authKey);
	if (pathExists(homeConfigDir)) {
		await remove(homeConfigDir);
	}

	console.log(chalk.blueBright('[CONFIG] Configuration cleaned'));
}
async function cleanRemote(projectName: string, authKey: string) {
}

export async function keygen() {
	// Get GeneratedKeys
	const { publicSSH_key } = generateKeys();
	console.log(publicSSH_key);
}
