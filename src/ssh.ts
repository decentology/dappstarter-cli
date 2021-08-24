import { lookup } from 'dns/promises';
import { readJson, writeFile } from 'fs-extra';
import { join } from 'path';
import keypair from 'keypair';
import forge from 'node-forge';
import { SSHConnection } from 'node-ssh-forward';
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
			// debug: async (msg) => {
			// 	await appendFile('log.txt', msg + '\n');
			// },
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
			symbol: emoji.get('cross_mark'),
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
	privateKey: string
) {
	let portStatus = await Promise.all(
		ports.map(async (port) => {
			if (typeof port === 'number') {
				return checkPortIsAvailable(port);
			} else {
				return checkPortIsAvailable(port.localPort);
			}
		})
	);

	const arePortsAvailable = portStatus.every((x) => x.valid === true);

	if (arePortsAvailable) {
		for (const port of ports) {
			if (typeof port === 'number') {
				await forwardRemotePort({ port, host, privateKey });
			} else {
				await forwardRemotePort({
					port: port.localPort,
					host,
					privateKey,
					remotePort: port.remotePort || port.localPort,
				});
			}
		}

		return true;
	} else if (portStatus.every((x) => x.valid === false)) {
		// Every port used. Likely connected to another terminal session.
		return true;
	}

	portStatus
		.filter((x) => !x.valid)
		.forEach((port) => {
			console.log(chalk.red(`Port ${port.port} is already in use.`));
		});

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
}) {
	let spinner = ora(`Fowarding port ${port} `).start();
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
							});

							await connection.forward({
								fromPort: port,
								toPort: remotePort || port,
							});

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
				handleError: (error) => {
					log(error);
				},
				beforeAttempt: (context, options) => {
					// console.log('Attempting to reconnect', context.attemptNum);
				},
			}
		);

		spinner.clear();
		spinner.stopAndPersist({
			symbol: emoji.get('heavy_check_mark'),
			text: `Port ${port} forwarded to ${host}`,
		});
		return connection;
	} catch (error) {
		spinner.fail('SSH connection error');
		console.error('Major SSH error', error);
		throw new Error('Major SSH error');
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
