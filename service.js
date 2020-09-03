const fetch = require("node-fetch");
const chalk = require("chalk");
const emoji = require("node-emoji");
const ora = require("ora");
const AdmZip = require("adm-zip");

const serviceUrl =
  process.env.DAPPSTARTER_SERVICE_URL ||
  "https://dappstarter-api.trycrypto.com";

const loading = (message) => {
  return ora(message).start();
};

const getManifest = async () => {
  const errorMessage = chalk.red(
    `${emoji.get("x")} Unable to fetch DappStarter manifest.`
  );
  const spinner = loading("Fetching manifest...");
  try {
    const resp = await fetch(`${serviceUrl}/manifest`);
    if (resp.ok) {
      const data = await resp.json();
      return data;
    }
    console.error(errorMessage);
  } catch (error) {
    if (process.env.DAPPSTARTER_DEBUG === "true") {
      console.error(error);
    }
    console.error(errorMessage);
  } finally {
    spinner.stop();
  }
};

const postSelections = async (outputPath, dappName, options) => {
  let errorMessage = chalk.red(
    `${emoji.get("x")} Unable to process configuration.`
  );
  const spinner = loading("DappStarter complete. Generating project...");
  try {
    const resp = await fetch(`${serviceUrl}/process?github=false`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dappName, blocks: options }),
    });
    if (resp.ok) {
      let { url } = await resp.json();
      let fileResp = await fetch(url);
      if (fileResp.ok) {
        let zip = new AdmZip(await fileResp.buffer());
        await zip.extractAllToAsync(outputPath);
      }

      return true;
    }
    console.error(errorMessage);
  } catch (error) {
    if (process.env.DAPPSTARTER_DEBUG === "true") {
      console.error(error);
    }
    console.error(errorMessage);
  } finally {
    spinner.stopAndPersist({
      symbol: emoji.get('100'),
      text: spinner.text + ' Done!'
    });
  }
};

module.exports = { getManifest, postSelections };
