import { join } from 'path';
import { pathExists, readFile, readJSON, writeJSON } from 'fs-extra';
import yaml from 'js-yaml';
import { setPorts } from './constants';
import { log } from './utils';
import chalk from 'chalk';
import { DevelopConfig, DevelopConfigBase } from './types';

export async function checkLocalFileConfiguration(folderPath: string) {
	const filename = 'dappstarter.yml';
	if (await pathExists(join(folderPath, filename))) {
		const config = yaml.load(await readFile(join(folderPath, filename), 'utf8')) as { ports: number[] };;
		if (config?.ports) {
			setPorts(config.ports);
		}
		return config;
	}
}
export async function storeConfigurationFile(filePath: string, config: DevelopConfigBase) {
	await writeJSON(filePath, config, { spaces: 4 });
	log(chalk.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}
export async function getConfiguration(filePath: string): Promise<DevelopConfig> {
	const { projectUrl } = await readJSON(join(filePath, 'config.json'));
	const privateKey = await readFile(join(filePath, 'privatekey'), 'utf8');
	const publicKey = await readFile(join(filePath, 'publickey'), 'utf8');
	return {
		projectUrl,
		privateKey,
		publicKey,
	};
}
