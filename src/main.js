#!/usr/bin/env node
require("dotenv").config();
const { Command } = require("commander");
const { getManifest, postSelections } = require("./service");
const { promises } = require("fs");
const { readFile, writeFile, mkdir } = promises;
const { basename, join } = require("path");
const { from, defer, interval } = require("rxjs");
const {
  map,
  mergeAll,
  filter,
  takeWhile,
  tap,
} = require("rxjs/operators");
const chalk = require("chalk");
const inquirer = require("inquirer");
const emoji = require("node-emoji");
const isUrl = require("is-url");
const { default: fetch } = require("node-fetch");
const ora = require("ora");
const { processManifest: pm } = require("./processManifest");
const { homedir } = require("os");
const { ensureDir, writeJson } = require("fs-extra");
const open = require("open");
const JwtDecode = require("jwt-decode");
let blockchain = { value: '' };
let options = [];
let stdin = "";
const tenantId = '0c797b4f-3993-439c-8af7-00076525b62e';
const clientId = 'd767bdbb-1d9f-42d7-b113-1760c501b228';
const processManifest = pm.bind(null, blockchain);
const program = new Command();
program.version("1.0.0");
program.description("Full-Stack Blockchain App Mojo!");

const login = program.command('login');
login.action(async () => {
  let deviceCodeRequest = await (await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: [`client_id=${clientId}`, 'scope=openid email user.read'].join('&'),
    })).json();

  console.log(chalk.yellow(deviceCodeRequest.message));
  open(deviceCodeRequest.verification_uri);

  interval(deviceCodeRequest.interval * 1000).pipe(
    map(() => defer(async () => {
      let resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: ["grant_type=device_code", `client_id=${clientId}`, `code=${deviceCodeRequest.device_code}`].join('&')
      });

      let body = await resp.json();

      return {
        status: resp.status,
        data: body
      }
    })),
    mergeAll(1),
    takeWhile(x => x.status != 200, true),
    filter(x => x.status === 200),
    tap(() => ensureDir(join(homedir(), '.dappstarter'))))
    .subscribe(result => {
      writeJson(join(homedir(), '.dappstarter', 'user.json'), result.data);
      let user = JwtDecode(result.data.access_token);
      console.log(chalk.green(`Successfully authenticated as ${user.email}`));
    });
});

const create = program.command("create");
create
  .option("-c, --config <file|url>", "Loads configuration from file and processes.")
  .option(
    "-o, --output <path>",
    "Output directory. If omitted current directory will be used."
  )
  .option(
    "-w, --write-config [path]",
    "Writes configuration to file without processing."
  )
  .option(
    "-p, --print-config",
    "Echos configuration to terminal without processing."
  )
  .action(async ({ output, writeConfig, printConfig, config }) => {
    if (output == null || output === "") {
      output = process.cwd();
      if (output.indexOf("dappstarter-cli-node") > -1) {
        output = join(output, "output");
      }
    }
    if (config || stdin) {
      let configFile = stdin !== "" ? JSON.parse(stdin) : "";
      if (configFile === "") {
        if (isUrl(config)) {
          let spinner = ora("Fetching configuration...");
          try {
            spinner.start();
            configFile = await (await fetch(config)).json();
            spinner.stopAndPersist({
              symbol: emoji.get("heavy_check_mark"),
              text: spinner.text + chalk.green(" Done!"),
            });
          } catch (error) {
            if (process.env.DAPPSTARTER_DEBUG === "true") {
              console.error(error);
            }
            console.log(
              chalk.red(
                `${emoji.get(
                  "x"
                )} Unable to load configuration from remote url.`
              )
            );
            spinner.stopAndPersist({
              symbol: emoji.get("x"),
              text: spinner.text + " Failure",
            });
            return;
          }
        } else {
          configFile = JSON.parse((await readFile(config)).toString());
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
          name: "inputName",
          type: "input",
          message: question,
        });

        if (inputName) {
          dappName = inputName;
        }
      }

      await from(manifest)
        .pipe(
          map((manifest) => defer(() => processManifest(options, manifest))),
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
        if (writeConfig === "" || writeConfig === true) {
          writeConfig = join(process.cwd(), "manifest.json");
        }

        if (await saveConfig(writeConfig, userConfiguration)) {
          console.log(
            chalk.green(
              `${emoji.get(
                "heavy_check_mark"
              )} DappStarter configuration saved to: ${writeConfig}`
            )
          );
        }
      } else {
        await mkdir(output, { recursive: true });
        await postSelections(output, dappName, userConfiguration.blocks);
      }
    }
  });

if (process.stdin.isTTY) {
  program.parse(process.argv);
} else {
  process.stdin.on("readable", function () {
    let chunk = this.read();
    if (chunk !== null) {
      stdin += chunk;
    }
  });
  process.stdin.on("end", () => program.parse(process.argv));
}

async function saveConfig(path, config) {
  try {
    await writeFile(path, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error(chalk.red(`${emoji.get("x")} Unable to save configuration.`));
  }
}
