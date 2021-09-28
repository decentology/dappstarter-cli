import { lookup } from 'dns/promises';
import { appendFileSync, readFile, writeFile } from 'fs-extra';
import { homedir } from 'os';
import { join } from 'path';
import keypair from 'keypair';
import forge from 'node-forge';
import { SSHConnection } from '@decentology/node-ssh-forward';
import { Client } from 'ssh2';
import ora from 'ora';
import * as emoji from 'node-emoji';
import {
	defer,
	interval,
	lastValueFrom,
	mergeMap,
	takeUntil,
	takeWhile,
	tap,
	timer,
} from 'rxjs';
import { retry } from '@lifeomic/attempt';
import { timeout } from 'promise-timeout';
import isReachable from 'is-reachable';
import chalk from 'chalk';
import humanizeDuration from 'humanize-duration';
import getPort from 'get-port';
import { log } from './utils';

export async function remoteConnect(
	projectUrl: string,
	privateKey: string
): Promise<void> {
	return new Promise(async (resolve) => {
		const conn = new Client();
		conn.on('error', async () => {
			// Handling error event prevents process termination. Need to handle reconnection
			console.log(chalk.yellow(`[SSH] Connection lost`));
			// await remoteConnect(projectUrl, privateKey);
		});
		conn.on('ready', function () {
			conn.shell(
				{
					term: process.env.TERM,
					rows: process.stdout.rows,
					cols: process.stdout.columns,
				},
				function (err, stream) {
					if (err) throw err;
					// stream.stdin.write('cd /app\nclear\n', 'utf-8');

					// Connect local stdin to remote stdin
					process.stdin.setRawMode(true);
					process.stdin.pipe(stream);

					// Connect remote output to local stdout
					stream.pipe(process.stdout);

					stream.on('close', () => {
						// Don't let process.stdin keep process alive since we no longer need it
						process.stdin.unref();

						conn.end();
						resolve();
					});

					stream.on('exit', () => {
						conn.end();
						resolve();
					});

					process.stdout.on('resize', () => {
						// Let the remote end know when the local terminal has been resized
						stream.setWindow(
							process.stdout.rows,
							process.stdout.columns,
							0,
							0
						);
					});
				}
			);
		}).connect({
			host: projectUrl,
			port: 22,
			username: 'dappstarter',
			privateKey: privateKey,
			keepaliveCountMax: 10,
			keepaliveInterval: 5000,
		});
	});
}

export async function isSshOpen(projectUrl: string): Promise<boolean> {
	const startTime = new Date().getTime();
	const timeout = timer(5 * 60 * 1000);
	const updateText = () =>
		`Waiting for container to be connectable... ${humanizeDuration(
			startTime - new Date().getTime(),
			{ maxDecimalPoints: 1 }
		)} `;
	const spinner = ora(updateText()).start();
	const result = await lastValueFrom(
		interval(1000).pipe(
			tap(() => (spinner.text = updateText())),
			mergeMap(() =>
				defer(async () => await isReachable(`${projectUrl}:22`))
			),
			takeWhile((x) => !x, true),
			takeUntil(timeout)
		),
		{ defaultValue: true }
	);

	if (result) {
		spinner.stopAndPersist({
			symbol: emoji.get('heavy_check_mark'),
			text: spinner.text + chalk.green('Connected'),
		});
	} else {
		spinner.stopAndPersist({
			symbol: emoji.get('x'),
			text: spinner.text + chalk.red('Not Connected'),
		});
	}

	return result;
}

async function checkPortIsAvailable(port: number) {
	let checkPort = await getPort({ port });
	if (checkPort !== port) {
		return { port, valid: false };
	}
	return { port, valid: true };
}

export async function forwardPorts(
	ports: (number | { localPort: number; remotePort?: number })[],
	host: string,
	privateKey: string,
	silent: boolean = false
) {
	const spinner = ora(`Forwarding ports: `);
	if (!silent) {
		process.stdin.pause();
		spinner.start();
	}

	const portNumbers = ports.map((port) => {
		if (typeof port === 'number') {
			return port;
		}
		return port.localPort;
	});
	const portTextPrefix = 'Forwarding ports: ';
	let portText =
		portTextPrefix + portNumbers.map((x) => chalk.gray(x)).join(',');

	let portStatus = await Promise.all(
		portNumbers.map(async (port) => {
			return checkPortIsAvailable(port);
		})
	);

	const arePortsAvailable = portStatus.every((x) => x.valid === true);

	if (arePortsAvailable) {
		await Promise.all(
			portNumbers.map(async (port) => {
				portText = portText.replace(
					port.toString(),
					chalk.yellow(port.toString())
				);
				spinner.text = portText;
				const connection = await forwardRemotePort({
					port,
					host,
					privateKey,
				});
				if (connection == null) {
					console.log(chalk.red(`Failed to forward port ${port}`));
					process.exit(1);
				}
				portText = portText.replace(
					port.toString(),
					chalk.green(port.toString())
				);
				spinner.text = portText;
			})
		);

		if (!silent) {
			spinner.stopAndPersist({
				symbol: emoji.get('heavy_check_mark'),
				text: portText,
			});
		}

		process.stdin.resume();
		return true;
	}

	portStatus
		.filter((x) => !x.valid)
		.forEach((port) => {
			portText = portText.replace(
				port.port.toString(),
				chalk.red(port.port.toString())
			);
		});

	if (!silent) {
		spinner.stopAndPersist({
			symbol: emoji.get('x'),
			text: portText,
		});
	}
	process.stdin.resume();
	return false;
}

export async function forwardRemotePort({
	port,
	remotePort,
	host,
	privateKey,
}: {
	port: number;
	remotePort?: number;
	host: string;
	privateKey: string;
}): Promise<SSHConnection | null> {
	try {
		const connection = await retry(
			async (context) => {
				return await timeout(
					new Promise(async (resolve, reject) => {
						let dnsResult = null;
						try {
							dnsResult = await lookup(host);
							// console.log(dnsResult);
						} catch (error) {
							return reject(`Could not resolve ${host}`);
						}

						try {
							const connection = new SSHConnection({
								endHost: dnsResult.address,
								privateKey,
								username: 'dappstarter',
								endPort: 22,
								keepaliveCountMax: 10,
								keepaliveInterval: 5000,
							});

							await connection.forward({
								fromPort: port,
								toPort: remotePort || port,
							});

							// This isn't being used. Keeping here as reminder how to handle reconnect with updating console.log
							async function reconnect() {
								process.stdin.pause();
								console.log(
									chalk.yellow(
										`Port ${port} disconnected. Reconnecting...`
									)
								);
								await forwardRemotePort({
									port,
									remotePort,
									host,
									privateKey,
								});
								process.stdin.resume();
							}

							return resolve(connection);
						} catch (error) {
							reject(error);
						}
					}).catch((err) => {
						throw err;
					}),
					8000
				).catch((err) => {
					throw err;
				});
			},
			{
				maxAttempts: 120,
				delay: 1000,
				handleError: (error, context) => {
					log(error);
					if (
						error.message ===
						'All configured authentication methods failed'
					) {
						context.abort();
					}
				},
				beforeAttempt: (context, options) => {
					var i = 1;
					// console.log('Attempting to reconnect', context.attemptNum);
				},
			}
		);
		return connection as SSHConnection;
	} catch (error) {
		console.error(`[SSH] ${error.message}`);
		return null;
	}
}

export function generateKeys() {
	const { private: privatePemKey, public: publicPemKey } = keypair();
	let publicKey = forge.pki.publicKeyFromPem(publicPemKey);
	let privateKey = forge.pki.privateKeyFromPem(privatePemKey);
	let publicSSH_key = forge.ssh.publicKeyToOpenSSH(
		publicKey,
		'dappstarter@localhost'
	);
	let privateSSH_key = forge.ssh.privateKeyToOpenSSH(privateKey);
	return {
		publicSSH_key,
		privateSSH_key,
	};
}

export async function createKeys(homeConfigDir: string) {
	const { publicSSH_key, privateSSH_key } = generateKeys();
	await writeFile(join(homeConfigDir, 'publickey'), publicSSH_key, {
		mode: 0o600,
	});
	await writeFile(join(homeConfigDir, 'privatekey'), privateSSH_key, {
		mode: 0o600,
	});

	return {
		privateKey: privateSSH_key,
		publicKey: publicSSH_key,
	};
}

