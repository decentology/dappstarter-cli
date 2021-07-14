import { lookup } from 'dns/promises';
import { readJson, writeFile } from 'fs-extra';
import { join } from 'path';
import keypair from 'keypair';
import forge from 'node-forge';
import { SSHConnection } from 'node-ssh-forward';
import polly from 'polly-js';
import { Client } from 'ssh2';
import { DevelopConfig } from './types';
import ora from 'ora';
import * as emoji from 'node-emoji';
import { defer, from, throwError, timeout } from 'rxjs';
import {retry} from '@lifeomic/attempt'

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

					// Connect local stdin to remote stdin
					process.stdin.setRawMode(true);
					process.stdin.pipe(stream);

					// Connect remote output to local stdout
					stream.pipe(process.stdout);
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

export async function forwardPorts(
	ports: [number | { localPort: number; remotePort?: number }],
	host: string,
	privateKey: string
) {
	ports.forEach(async (port) => {
		if (typeof port === 'number') {
			await forwardRemotePort({
				port,
				host,
				privateKey,
			});
		} else if (typeof port === 'object') {
			await forwardRemotePort({
				port: port.localPort,
				remotePort: port.remotePort || port.localPort,
				host,
				privateKey,
			});
		}
	});
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
	let spinner = ora(`Fowarding port ${port}`).start();
	let counter = 0;
	let connection = await polly()
		.logger((err) => {
			console.error('Unable to connect to port. Retrying...', err);
		})
		.waitAndRetry(30)
		.executeForPromise(async () => {
			counter += 1;
			return await defer(async () => {
				let dnsResult = null;
				try {
					dnsResult = await lookup(host);
				} catch (error) {
					throw new Error(`Could not resolve ${host}`);
				}

				console.log(`I am trying to connect again ${counter}`);
				const sshConnection = new SSHConnection({
					endHost: dnsResult.address,
					privateKey,
					username: 'dappstarter',
					endPort: 22,
				});

				await sshConnection.forward({
					fromPort: port,
					toPort: remotePort || port,
				});
				console.log(`I connected ${counter}`);
				return sshConnection;
			})
				.pipe(
					timeout({
						first: 2000,
						with: () => throwError(() => new Error('Timeout'))

					})
				)
				.toPromise();
		});
	spinner.clear();
	spinner.stopAndPersist({
		symbol: emoji.get('heavy_check_mark'),
		text: `Port ${port} forwarded to ${host}`,
	});
	return connection;
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
	await writeFile(join(homeConfigDir, 'publickey'), publicSSH_key);
	await writeFile(join(homeConfigDir, 'privatekey'), privateSSH_key);

	return {
		privateKey: privateSSH_key,
		publicKey: publicSSH_key,
	};
}

/// @deprecated - This doesn't work without opening connection first for local port
async function forwardRemotePorts_old(
	configPath: string,
	projectUrl: string
): Promise<void> {
	return new Promise(async (resolve) => {
		const conn = new Client();
		try {
			conn.on('ready', () => {
				console.log('Client :: ready');
				conn.forwardOut(
					projectUrl,
					7000,
					'localhost',
					5002,
					(err, stream) => {
						if (err) throw err;
						stream
							.on('close', () => {
								console.log('TCP :: CLOSED');
								process.stdin.unref();
								conn.end();
								resolve();
							})
							.on('data', (data: string) => {
								console.log('TCP :: DATA: ' + data);
							});
					}
				);
			}).connect({
				host: projectUrl,
				port: 22,
				username: 'dappstarter',
				privateKey: ((await readJson(configPath)) as DevelopConfig)
					.privateKey,
			});
		} catch (error) {
			console.error(error);
		}
	});
}
