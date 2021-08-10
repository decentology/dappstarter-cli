import { getManifest, postSelections } from './service';
import { promises } from 'fs';
import { basename, join } from 'path';
import { from, defer } from 'rxjs';
import { map, mergeAll } from 'rxjs/operators';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import * as emoji from 'node-emoji';
import isUrl from 'is-url';
import fetch from 'node-fetch';
import ora from 'ora';
import pm from './processManifest';
import { homedir } from 'os';
import loginDialog from './auth';
import { ensureDir, readdir } from 'fs-extra';
const { readFile, writeFile, mkdir, stat } = promises;

let globalSelections = { blockchain: '', language: '' };
let options: any[] = [];
const processManifest = pm.bind(null, globalSelections);
export default async function createAsync(
	{ stdin }: { stdin: string },
	{ output, writeConfig, printConfig, config }: any
) {
	let authenticated = await stat(
		join(homedir(), '.dappstarter', 'user.json')
	).catch((err) => false);
	while (!authenticated) {
		if (!authenticated) {
			console.log(
				chalk.yellow(
					'You must be authenticated to generate a project. Executing: dappstarter login'
				)
			);
			await loginDialog();
			authenticated = await stat(
				join(homedir(), '.dappstarter', 'user.json')
			).catch((err) => false);
		}
	}
	if (output == null || output === '') {
		output = process.cwd();
		if (
			output.includes('dappstarter-cli-node') ||
			output.includes('dappstarter-cli')
		) {
			output = join(output, 'output');
		}
	}

	await ensureDir(output);
	await isOutputDirectoryEmpty(output);

	if (config || stdin) {
		let configFile = stdin !== '' ? JSON.parse(stdin) : '';
		if (configFile === '') {
			if (isUrl(config)) {
				let spinner = ora('Fetching configuration...');
				try {
					spinner.start();
					configFile = await (await fetch(config)).json();
					spinner.stopAndPersist({
						symbol: emoji.get('heavy_check_mark'),
						text: spinner.text + chalk.green(' Done!'),
					});
				} catch (error) {
					if (process.env.DAPPSTARTER_DEBUG === 'true') {
						console.error(error);
					}
					console.log(
						chalk.red(
							`${emoji.get(
								'x'
							)} Unable to load configuration from remote url.`
						)
					);
					spinner.stopAndPersist({
						symbol: emoji.get('x'),
						text: spinner.text + ' Failure',
					});
					return;
				}
			} else {
				configFile = JSON.parse((await readFile(config)).toString());
			}
		}
		// Support both standard JOSN format and flattened JSON format
		await postSelections(output, configFile.name, configFile.blockchain ? configFile : configFile.blocks);
		return;
	}

	const manifest = await getManifest();
	if (manifest != null) {
		let dappName = basename(process.cwd());
		if (manifest) {
			let question = `Enter name for your dapp (${dappName}) `;

			let { inputName } = await inquirer.prompt({
				name: 'inputName',
				type: 'input',
				message: question,
			});

			if (inputName) {
				dappName = inputName;
			}
		}

		await from(manifest)
			.pipe(
				map((manifest) =>
					defer(() => processManifest(options, manifest))
				),
				mergeAll(1)
			)
			.toPromise();

		let userConfiguration = {
			name: dappName,
			blocks: {
				...options,
			},
		};
		if (printConfig) {
			console.log(userConfiguration);
		} else if (writeConfig != null) {
			if (writeConfig === '' || writeConfig === true) {
				writeConfig = join(process.cwd(), 'manifest.json');
			}

			if (await saveConfig(writeConfig, userConfiguration)) {
				console.log(
					chalk.green(
						`${emoji.get(
							'heavy_check_mark'
						)} DappStarter configuration saved to: ${writeConfig}`
					)
				);
			}
		} else {
			await mkdir(output, { recursive: true });
			await postSelections(output, dappName, userConfiguration.blocks);
		}
	}
}
async function isOutputDirectoryEmpty(
	outputFolder: string,
	force: boolean = false
) {
	const files = await readdir(outputFolder);
	// TODO: Add  --force option to overwrite existing files
	if (files.length > 0 && !force) {
		const { value } = await inquirer.prompt({
			name: 'value',
			type: 'confirm',
			message:
				'Output directory is not empty. Are you sure you want to continue?',
		});
		if (!value) {
			process.exit(1);
		}
	}
}
async function saveConfig(path: string, config: any) {
	try {
		await writeFile(path, JSON.stringify(config));
		return true;
	} catch (error) {
		console.error(
			chalk.red(`${emoji.get('x')} Unable to save configuration.`)
		);
	}
}
