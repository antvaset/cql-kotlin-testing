# Regression test suite for CQL compiler

## Setup

* Clone cqframework/clinical_quality_language twice and check out the master branch in one and the feature-kotlin branch in the other. 
* Copy `config.template.js` to `config.js` and fill in the paths to `/Src/java` for the two repositories.
* Create tmp directory in the root of the project and clone all the content IG repositories in it. Add 2025 eCQM measures to the tmp/2025-eCQM/input/cql directory.
* Run

```shell
npm install
npm run-1.js
npm run-2.js
```