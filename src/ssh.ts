import { readJson, writeFile } from 'fs-extra';
import { join } from 'path';
import keypair from 'keypair';
import forge from 'node-forge';
import { SSHConnection } from 'node-ssh-forward';
import polly from 'polly-js';
import { Client } from 'ssh2';
import { DevelopConfig } from './types';

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
						process.exit(0);
					});

					stream.on('exit', () => {
						conn.end();
						resolve();
						process.exit(0);
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

export async function forwardRemotePort({
	port,
	remotePort,
	configPath,
	projectUrl,
}: {
	port: number;
	remotePort?: number;
	configPath: string;
	projectUrl: string;
}) {
	return polly()
		.waitAndRetry(5)
		.executeForPromise(async () => {
			return new Promise(async (resolve) => {
				const sshConnection = new SSHConnection({
					endHost: projectUrl,
					privateKey: ((await readJson(configPath)) as DevelopConfig)
						.privateKey,
					username: 'dappstarter',
					endPort: 22,
				});

				await sshConnection.forward({
					fromPort: port,
					toPort: remotePort || port,
				});
				resolve(sshConnection);
			});
		});
}

export async function createKeys(homeConfigDir: string) {
	const { private: privatePemKey, public: publicPemKey } = keypair();
	let publicKey = forge.pki.publicKeyFromPem(publicPemKey);
	let privateKey = forge.pki.privateKeyFromPem(privatePemKey);
	let publicSSH_key = forge.ssh.publicKeyToOpenSSH(
		publicKey,
		'dappstarter@localhost'
	);
	let privateSSH_key = forge.ssh.privateKeyToOpenSSH(privateKey);
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
