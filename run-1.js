const { execSync } = require("child_process");
const fs = require("fs");
const { masterSrc, kotlinSrc } = require("./config.js");
const { igs, inputSubdirs } = require("./shared.js");

// Build the cql-to-elm-cli
execSync(`cd ${masterSrc} && ./gradlew :cql-to-elm-cli:installDist`, {
  stdio: "inherit",
});
execSync(`cd ${kotlinSrc} && ./gradlew :cql-to-elm-cli:installDist`, {
  stdio: "inherit",
});

// Clean up tmp
execSync(`rm -rf ${__dirname}/tmp && mkdir ${__dirname}/tmp`, {
  stdio: "inherit",
});

for (const ig of igs) {
  const { repo } = ig;
  const dir = repo.split("/")[1];

  // Clone the IG repo
  execSync(
    `cd ${__dirname}/tmp && git clone --depth=1 git@github.com:${ig.repo}.git ${dir}`,
    { stdio: "inherit" },
  );

  // Create the master and kotlin directories to store the ELM output
  execSync(`cd ${__dirname}/tmp/${dir} && mkdir master && mkdir kotlin`, {
    stdio: "inherit",
  });

  // Look for input CQL
  for (const inputSubdir of inputSubdirs) {
    const inputDir = `${__dirname}/tmp/${dir}${inputSubdir}`;
    if (fs.existsSync(inputDir)) {
      // Compile CQL
      execSync(
        `cd ${masterSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/master`,
        { stdio: "inherit" },
      );
      execSync(
        `cd ${kotlinSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/kotlin`,
        { stdio: "inherit" },
      );
    }
  }
}
