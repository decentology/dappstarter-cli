const { from, defer } = require("rxjs");
const { map, mergeAll } = require("rxjs/operators");
const inquirer = require("inquirer");

async function showParams(options, path, params) {
  return await from(params)
    .pipe(
      map((/** @type {any} */ param) =>
        defer(async () => {
          let {
            name,
            title,
            description,
            placeholder,
            options: paramOptions,
          } = param;

          if (param.type === "choice") {
            const menuList = param.options.map((x) => x.title);
            let { value } = await inquirer.prompt({
              name: "value",
              type: "list",
              message: `Choose ${title}`,
              choices: menuList,
            });

            let selection = paramOptions.find((x) => x.title == value);
            let optionPath = path + "/" + name;
            options[optionPath] = selection.name;
          } else {
            placeholder =
              placeholder != null
                ? ` (${placeholder}, ${description})`
                : ` (${description})`;
            let value = await inquirer.prompt({
              name,
              type: "input",
              message: `Enter: ${title}${placeholder}`,
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
