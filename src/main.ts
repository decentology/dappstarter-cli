#!/usr/bin/env node
require('dotenv').config();
import { Command, createCommand } from 'commander';
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
import developCommand from './develop';
const { readFile, writeFile, mkdir, stat } = promises;
let globalSelections = { blockchain: '', language: '' };
let options: any[] = [];
let stdin = '';

process.on('uncaughtException', (err: any) => {
	if (err.code === 'EADDRINUSE') {
		// console.log('Port already in use');
		return;
	} else if (err.message.includes('Timed out while waiting for handshake')) {
		// console.log('Ignoring timeout error');
		return;
	} else if (err.message.includes('Could not resolve')) {
		// console.log('Ignoring DNS Resolution error');
		return;
	}
	else {
		console.log('Unhandled exception. Shutting down', err);
	}
	process.exit(1);
});

const processManifest = pm.bind(null, globalSelections);
const program = new Command();
program.version('1.0.0');
program.description('Full-Stack Blockchain App Mojo!');

const login = program.command('login');
login.action(loginDialog);

const develop = program.command('develop')
	.option('-d, --input-directory <path>', 'Select a different directory then current path')
	.option('--debug', 'Emits debug progress for each command')
	.argument('[clean]', 'Clears local configuration and terminates remote container')
	.argument('[debug] <monitor|keygen>', 'Clears local configuration and terminates remote container')
develop.action(developCommand);

const create = program.command('create');
create
	.option(
		'-c, --config <file|url>',
		'Loads configuration from file and processes.'
	)
	.option(
		'-o, --output <path>',
		'Output directory. If omitted current directory will be used.'
	)
	.option(
		'-w, --write-config [path]',
		'Writes configuration to file without processing.'
	)
	.option(
		'-p, --print-config',
		'Echos configuration to terminal without processing.'
	)
	.action(async ({ output, writeConfig, printConfig, config }) => {
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
					configFile = JSON.parse(
						(await readFile(config)).toString()
					);
				}
			}
			await postSelections(output, configFile.name, configFile.blocks);
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
				await postSelections(
					output,
					dappName,
					userConfiguration.blocks
				);
			}
		}
	});

if (process.stdin.isTTY) {
	program.parse(process.argv);
} else {
	process.stdin.on('readable', function () {
		let chunk = this.read();
		if (chunk !== null) {
			stdin += chunk;
		}
	});
	process.stdin.on('end', () => program.parse(process.argv));
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
