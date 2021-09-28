import {
	pathExists,
	readFile,
	readJSON,
	writeJSON,
	writeFile,
	ensureFile,
} from 'fs-extra';
import yaml from 'js-yaml';
import { log } from './utils';
import chalk from 'chalk';
import { DevelopConfig, DevelopConfigBase } from './types';
import { homedir } from 'os';
import { basename, join } from 'path';
import hash from 'string-hash';
const SSHConfig = require('ssh-config');

export const REQUEST_TIMEOUT: number = 10 * 1000;
export const CONFIG_FILE = 'config.json';
export let SERVICE_URL =
	process.env.DAPPSTARTER_SERVICE_URL ||
	'https://dappstarter-api.decentology.com';

export let PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];
export let CUSTOM_PORTS = false;
export let PUBLIC_URL_ENABLED = true;
export let PRIMARY_HOST_PROCESS = false;
export let IS_REMOTE_CONTAINER = false;

export function setServiceUrl(url: string) {
	process.env.DAPPSTARTER_SERVICE_URL = url;
	SERVICE_URL = url;
}

export function setPrimaryHostProcess(isPrimary: boolean) {
	PRIMARY_HOST_PROCESS = isPrimary;
}

export function setPorts(ports: number[]) {
	PORTS = ports;
	CUSTOM_PORTS = true;
}

export function setCustomPorts(value: boolean) {
	CUSTOM_PORTS = value;
}

export function setPublicUrlEnabled(value: boolean) {
	PUBLIC_URL_ENABLED = value;
}

export function setIsRemoteContainer(isRemote: boolean) {
	IS_REMOTE_CONTAINER = isRemote;
}

export function initPaths(inputDirectory: string) {
	const folderPath = inputDirectory || process.cwd();
	const rootFolderName = basename(folderPath);
	const hashFolderPath = hash(folderPath);
	const projectName = `${rootFolderName}-${hashFolderPath}`;
	const homeConfigDir = join(homedir(), '.dappstarter', projectName);
	const configFilePath = join(homeConfigDir, CONFIG_FILE);
	return {
		folderPath,
		rootFolderName,
		hashFolderPath,
		projectName,
		homeConfigDir,
		configFilePath,
	};
}

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
	await addHost({
		projectName: config.projectName,
		projectUrl: config.projectUrl,
	});
	log(chalk.blueBright('[CONFIG] Configuration file saved: ' + filePath));
}
export async function getConfiguration(
	filePath: string
): Promise<DevelopConfig> {
	const { projectUrl, projectName } = await readJSON(
		join(filePath, 'config.json')
	);
	const privateKey = await readFile(join(filePath, 'privatekey'), 'utf8');
	const publicKey = await readFile(join(filePath, 'publickey'), 'utf8');
	return {
		projectUrl,
		projectName,
		privateKey,
		publicKey,
	};
}

export async function addHost({
	projectName,
	projectUrl,
}: {
	projectName: string;
	projectUrl: string;
}) {
	const sshConfigDir = join(homedir(), '.ssh');
	const configFile = join(sshConfigDir, 'config');
	await ensureFile(configFile);
	const config = await readFile(configFile, 'utf8');
	let sshConfig = SSHConfig.parse(config);

	// Check if host already exists
	if (!config.includes(projectUrl)) {
		sshConfig.append({
			Host: projectName,
			User: 'dappstarter',
			HostName: projectUrl,
			IdentityFile: join(
				homedir(),
				'.dappstarter',
				projectName,
				'privatekey'
			),
			ForwardAgent: 'yes',
			ServerAliveInterval: 15,
			ServerAliveCountMax: 4,
		});
		await writeFile(configFile, SSHConfig.stringify(sshConfig), {
			mode: 0o600,
		});
	}
}

export async function removeHost(projectName: string) {
	const sshConfigDir = join(homedir(), '.ssh');
	const configFile = join(sshConfigDir, 'config');
	const config = await readFile(configFile, 'utf8');
	let sshConfig = SSHConfig.parse(config);
	sshConfig.remove({ Host: projectName });
	await writeFile(configFile, SSHConfig.stringify(sshConfig));
}
