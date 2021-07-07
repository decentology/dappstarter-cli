import fetch from "node-fetch";
import chalk from "chalk";
import { ensureDir, writeJson } from "fs-extra";
import { defer, interval } from "rxjs";
import { filter, map, mergeAll, takeWhile, tap } from "rxjs/operators";
import { join } from "path";
import { homedir } from "os";
import JwtDecode from "jwt-decode";
import open from "open";

const tenantId = "decentology.us.auth0.com";
const clientId = "94QrhsnCFTFSB6r37UKNFfFjDtC55ZRU";

export interface IAuth {
	access_token: string
	id_token: string
	scope: string,
	expires: number,
	token_type: string
}

export default async function loginDialog(): Promise<void> {
  let deviceCodeRequest = await (
    await fetch(`https://${tenantId}/oauth/device/code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: [`client_id=${clientId}`, "scope=openid email"].join("&"),
    })
  ).json();
  console.log(
    chalk.yellow(
      `Open your browser to ${deviceCodeRequest.verification_uri} and enter code ${deviceCodeRequest.user_code} to complete authentication.`
    )
  );
  open(deviceCodeRequest.verification_uri_complete);

  let result = await interval(deviceCodeRequest.interval * 1000)
    .pipe(
      map(() =>
        defer(async () => {
          let resp = await fetch(`https://${tenantId}/oauth/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: [
              "grant_type=urn:ietf:params:oauth:grant-type:device_code",
              `client_id=${clientId}`,
              `device_code=${deviceCodeRequest.device_code}`,
            ].join("&"),
          });

          let body = await resp.json();

          return {
            status: resp.status,
            data: body,
          };
        })
      ),
      mergeAll(1),
      takeWhile((x: any) => x.status != 200, true),
      filter((x: any) => x.status === 200),
      tap(() => ensureDir(join(homedir(), ".dappstarter")))
    )
    .toPromise()
    .catch((err: Error) => console.log(chalk.red(err)));
  if (result) {
    writeJson(join(homedir(), ".dappstarter", "user.json"), result.data);
    let user = JwtDecode(result.data.id_token) as { email: string };
    console.log(chalk.green(`Successfully authenticated as ${user.email}`));
  }
};
