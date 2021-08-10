import { homedir } from 'os';
import { basename, join } from 'path';
import hash from 'string-hash';

export const REQUEST_TIMEOUT: number = 10 * 1000;
export const CONFIG_FILE = 'config.json';
export let SERVICE_URL =
	process.env.DAPPSTARTER_SERVICE_URL ||
	'https://dappstarter-api.decentology.com';

export let PORTS = [5000, 5001, 5002, 8080, 8899, 8900, 12537];

export function setServiceUrl(url: string) {
	process.env.DAPPSTARTER_SERVICE_URL = url;
	SERVICE_URL = url;
}

export function setPorts(ports: number[]) {
	PORTS = ports;
}

export function initPaths(inputDirectory: string ) {
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
