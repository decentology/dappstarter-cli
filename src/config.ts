import { join } from 'path';
import { pathExists, readFile, readJSON, writeJSON } from 'fs-extra';
import yaml from 'js-yaml';
import { setPorts, setPublicUrlEnabled } from './constants';
import { log } from './utils';
import chalk from 'chalk';
import { DevelopConfig, DevelopConfigBase } from './types';

const FILE_NAMES = [
	'.dappstarter/dappstarter.yml',
	'.dappstarter/dappstarter.yaml',
	'.dappstarter',
	'.dappstarter.yml',
	'.dappstarter.yaml',
	'dappstarter.yml',
	'dappstarter.yaml',
];

type LocalConfig = {
	ports: number[];
	publicUrlEnabled: boolean;
};

async function findConfigFiles(cwd: string): Promise<string[]> {
	const files = await Promise.all(
		FILE_NAMES.map(async (fileName) => {
			const filePath = join(cwd, fileName);
			const exists = await pathExists(filePath);
			return exists ? filePath : null;
		})
	);
	return files.filter(Boolean);
}

export async function checkLocalFileConfiguration(folderPath: string) {
	const foundFiles = await findConfigFiles(folderPath);
	if (foundFiles.length > 1) {
		console.log(
			chalk.yellow(
				`[WARNING] Found multiple config files: ${foundFiles.join(
					', '
				)}. Using ${foundFiles[0]}`
			)
		);
	}
	if (foundFiles.length > 0) {
		const config = yaml.load(
			await readFile(foundFiles[0], 'utf8')
		) as LocalConfig;
		if (config?.ports && config.ports.length > 0) {
			setPorts(config.ports);
		}
		if (config?.hasOwnProperty('publicUrlEnabled')) {
			setPublicUrlEnabled(config.publicUrlEnabled);
		}
		return config;
	}
	return null;
}
export async function storeConfigurationFile(
	filePath: string,
	config: DevelopConfigBase
) {
	await writeJSON(filePath, config, { spaces: 4 });
	log(chalk.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}
export async function getConfiguration(
	filePath: string
): Promise<DevelopConfig> {
	const { projectUrl } = await readJSON(join(filePath, 'config.json'));
	const privateKey = await readFile(join(filePath, 'privatekey'), 'utf8');
	const publicKey = await readFile(join(filePath, 'publickey'), 'utf8');
	return {
		projectUrl,
		privateKey,
		publicKey,
	};
}
