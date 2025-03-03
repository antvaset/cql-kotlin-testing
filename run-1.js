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

for (const ig of igs) {
  const { repo } = ig;
  const dir = repo.split("/")[1];

  // Create the master and kotlin directories to store the ELM XML and ELM JSON output
  execSync(
    `cd ${__dirname}/tmp/${dir} && mkdir -p master && mkdir -p kotlin && mkdir -p master-json && mkdir -p kotlin-json`,
    {
      stdio: "inherit",
    },
  );

  // Look for input CQL
  for (const inputSubdir of inputSubdirs) {
    const inputDir = `${__dirname}/tmp/${dir}${inputSubdir}`;
    if (fs.existsSync(inputDir)) {
      // Compile CQL to ELM XML
      execSync(
        `cd ${masterSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/master`,
        { stdio: "inherit" },
      );
      execSync(
        `cd ${kotlinSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/kotlin`,
        { stdio: "inherit" },
      );

      // Compile CQL to ELM JSON
      execSync(
        `cd ${masterSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/master-json --format JSON`,
        { stdio: "inherit" },
      );
      execSync(
        `cd ${kotlinSrc} && ./cql-to-elm-cli/build/install/cql-to-elm-cli/bin/cql-to-elm-cli --input ${inputDir} --output ${__dirname}/tmp/${dir}/kotlin-json --format JSON`,
        { stdio: "inherit" },
      );
    }
  }
}
