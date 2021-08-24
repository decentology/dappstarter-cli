import { basename, join } from 'path';
import { homedir } from 'os';
import hash from 'string-hash';
import { CONFIG_FILE } from './constants';

export default async function localCommand(
	subCommand: any,
	subCommandOption: any,
	command: any,
	options: any
) {
	let folderPath = options?.inputDirectory || process.cwd();
	const rootFolderName = basename(folderPath);
	const hashFolderPath = hash(folderPath);
	const projectName = `${rootFolderName}-${hashFolderPath}`;
	const homeConfigDir = join(homedir(), '.dappstarter', projectName);
	const configFilePath = join(homeConfigDir, CONFIG_FILE);
}
