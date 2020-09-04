const { from, defer } = require("rxjs");
const { map, mergeAll } = require("rxjs/operators");
const inquirer = require("inquirer");

async function showParams(options, path, params) {
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
exports.showParams = showParams;
