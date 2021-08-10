#!/usr/bin/env node
require('dotenv').config();
import { Command, createCommand, createOption } from 'commander';
import loginDialog from './auth';
import developAction from './develop';
import { setEnv } from './env';
import { setLogLevel } from './utils';
import createAsync from './create';
import {
	cleanAction,
	downAction,
	localAction,
	localDownAction,
} from './develop.subcommands';
let stdin = {
	stdin: '',
};
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
	} else {
		console.log('Unhandled exception. Shutting down', err);
	}
	process.exit(1);
});

const program = new Command();
program
	// .enablePositionalOptions(true)
	.storeOptionsAsProperties(true)
	.option('-e, --env <environment>', 'Override environment setting.')
	.option('--debug', 'Emits debug progress for each command');

program.on('option:env', (env) => {
	setEnv(env);
});
process.on('option:debug', (debug) => {
	setLogLevel(true);
});
program.version('1.0.0');
program.description('Full-Stack Blockchain App Mojo!');

program
	.command('login')
	.description(
		'Authenticate with the Decentology service. Used for service connections and containers'
	)
	.action(loginDialog);

const inputDirectory = createOption(
	'-i, --input-directory <path>',
	'Select a different directory then current path'
);

const cleanCommand = createCommand('clean')
	.description(
		'Completely clears local configuration and removes remote container data and history'
	)
	.storeOptionsAsProperties(true)
	.action(cleanAction);

const develop = program
	.command('develop')
	.description(
		'Develop using a local or remote container to simplify up development workflow'
	)
	.addOption(inputDirectory)
	.action(developAction);

develop
	.command('down')
	.description('Manually shutdown remote container')
	.action(downAction);
develop.addCommand(cleanCommand);

const developLocal = develop
	.command('local')
	.addCommand(cleanCommand)
	.description('Use to initialize a docker container for local development')
	.action(localAction);

developLocal
	.command('down')
	.description('Manually shutdown local container')
	.action(localDownAction);

program
	.command('create')
	.description('Generate a new DappStarterp project')
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
	.action(createAsync.bind(this, stdin));

if (process.stdin.isTTY) {
	program.parse(process.argv);
} else {
	process.stdin.on('readable', function () {
		let chunk = this.read();
		if (chunk !== null) {
			stdin.stdin += chunk;
		}
	});
	process.stdin.on('end', () => program.parse(process.argv));
}
