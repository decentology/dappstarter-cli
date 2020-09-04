require("dotenv").config();
const { Command, option } = require("commander");
const { getManifest, postSelections } = require("./service");
const { promises } = require("fs");
const { readFile, writeFile, mkdir } = promises;
const { basename, join } = require("path");
const { Observable, from, merge, defer } = require("rxjs");
const {
  flatMap,
  tap,
  map,
  mergeMap,
  concatMap,
  mergeAll,
  switchMap,
} = require("rxjs/operators");
const chalk = require("chalk");
const inquirer = require("inquirer");
const { default: idx } = require("idx");
const emoji = require("node-emoji");
const isUrl = require("is-url");
const { default: fetch } = require("node-fetch");
const ora = require("ora");

const program = new Command();
program.version("1.0.0");
program.description("Full-Stack Blockchain App Mojo!");
let options = [];
let blockchain = "";
const create = program.command("create");
create
  .option("-c, --config <file>", "Loads configuration from file and processes.")
  .option(
    "-o, --output <path>",
    "Output directory. If omitted current directory will be used."
  )
  .option(
    "-w, --write-config [path]",
    "Writes configuration to file without processing."
  )
  .action(async ({ output, writeConfig, config }) => {
    if (output == null || output === "") {
      output = process.cwd();
      if (output.indexOf("dappstarter-cli-node") > -1) {
        output = join(output, "output");
      }
    }
    if (config) {
      let configFile = "";
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
              `${emoji.get("x")} Unable to load configuration from remote url.`
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
      await postSelections(output, configFile.name, configFile.blocks);
      return;
    }

    const manifest = await getManifest();
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
        map((manifest) => defer(() => processManifest(manifest))),
        mergeAll(1)
      )
      .toPromise();

    let userConfiguration = {
      name: dappName,
      blocks: {
        ...options,
      },
    };
    if (writeConfig != null) {
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

    if (process.env.DAPPSTARTER_DEBUG) {
      console.log("Config Selections", userConfiguration);
    }
  });
program.parse(process.argv);

async function saveConfig(path, config) {
  try {
    await writeFile(path, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error(chalk.red(`${emoji.get("x")} Unable to save configuration.`));
  }
}

async function processManifest(manifest) {
  let { singular, name, children } = manifest;
  let menuList = children
    .filter((x) => idx(x, () => x.interface.enabled))
    .map((x) => x.title);
  if (menuList && menuList.length > 0) {
    let doneMessage = "I'm done!";
    if (name == "categories") {
      menuList.unshift(doneMessage);
    }
    let { value } = await inquirer.prompt({
      type: "list",
      name: "value",
      message: `Select ${singular || name}`,
      choices: menuList,
    });

    let selection = children.find((x) => x.title == value);
    if (selection != null) {
      let pathName;
      if (/blockchains|frameworks/.test(name)) {
        if (name === "blockchains") {
          blockchain = selection.name;
        }
        pathName = name.substring(0, name.length - 1);
      } else if (name === "languages") {
        pathName = "blockchain/" + blockchain;
      } else if (name == "categories") {
        pathName = "category";
      }
      let path = `/${pathName}/${selection.name}`;
      options[path] = true;
      if (idx(selection, () => selection.children.length) > 0) {
        await processOptions(path, selection);
      }
    }

    if (name == "categories" && value != doneMessage) {
      await processManifest(manifest);
    }
  }
  // if(children(answer))
}

async function processOptions(path, { name, children, interface }) {
  let menuList = children
    .filter((x) => idx(x, () => x.interface.enabled))
    .map((x, i) => {
      return { name: x.title };
    });

  let listType = "list";
  switch (interface.children) {
    case "multiple":
      listType = "checkbox";
      break;
  }

  let { value } = await inquirer.prompt({
    name: "value",
    type: listType,
    message: "Select option",
    choices: menuList,
  });

  if (listType !== "checkbox") {
    let selection = children.find((x) => x.title == value);
    let optionPath = path + "/" + selection.name;
    options[optionPath] = true;
    if (selection.parameters != null) {
      await showParams(optionPath, selection.parameters);
    }
  } else {
    value.forEach((val) => {
      let selection = children.find((x) => x.title == val);
      let optionPath = path + "/" + selection.name;
      options[optionPath] = true;
    });
  }
}

async function showParams(path, params) {
  return await from(params)
    .pipe(
      map((param) =>
        defer(async () => {
          if (param.type === "choice") {
          } else {
            let { name, title, description, placeHolder } = param;
            placeHolder = placeHolder != null ? placeHolder + ", " : "";
            let value = await inquirer.prompt({
              name,
              type: "input",
              message: `Enter: ${title} (${placeHolder}{${description}})`,
            });
            let key = path + "/" + name;
            options[key] = value[name];
          }
        })
      ),
      mergeAll(1)
    )
    .toPromise();
}
