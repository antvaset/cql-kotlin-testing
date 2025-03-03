const { masterSrc, kotlinSrc } = require("./config.js");
const { igs, inputSubdirs } = require("./shared.js");
const { JSDOM } = require("jsdom");
const fs = require("fs");

function getAllFilePaths(path) {
  return fs.readdirSync(path).flatMap((fileOrDirName) => {
    const fileOrDirPath = `${path}/${fileOrDirName}`;
    if (fs.statSync(fileOrDirPath).isDirectory()) {
      return getAllFilePaths(fileOrDirPath);
    }
    return [fileOrDirPath];
  });
}

const parser = new new JSDOM().window.DOMParser();

// Parse a string like "PREFIX:LOCAL" into { ns: "NS_URI", local: "LOCAL" }
function parseIntoQname(str, namespaces) {
  const [ns, local] = str.includes(":") ? str.split(":") : ["", str];
  return { ns: namespaces[ns], local: local };
}

function normalizeXml(node, namespacesFromParents) {
  const allNamespaces = {
    ...namespacesFromParents,
    ...Array.from(node.attributes || [])
      .filter((attr) => attr.name.startsWith("xmlns"))
      .reduce((acc, attr) => {
        if (attr.name.includes(":")) {
          acc[attr.name.split(":")[1]] = attr.value;
        } else {
          acc[""] = attr.value;
        }
        return acc;
      }, {}),
  };

  const tag = parseIntoQname(node.tagName, allNamespaces);
  const attributesUnsorted = {};
  for (const attr of node.attributes || []) {
    if (attr.name.startsWith("xmlns")) {
      // skip
    } else if (attr.name === "xsi:type") {
      const xsiType = parseIntoQname(attr.value, allNamespaces);
      if (
        [
          "AliasedQuerySource",
          "Property",
          "ExpressionRef",
          "ExpressionDef",
        ].includes(xsiType.local)
      ) {
        // Ignore xsi:type for base non-abstract classes
      } else {
        attributesUnsorted[attr.name] = xsiType;
      }
    } else if (attr.name === "translatorVersion") {
      // Ignore translatorVersion
    } else if (/^\w+:/.test(attr.value)) {
      // Parse as QName
      attributesUnsorted[attr.name] = parseIntoQname(attr.value, allNamespaces);
    } else {
      attributesUnsorted[attr.name] = attr.value;
    }
  }
  const attributes = Object.fromEntries(
    Object.entries(attributesUnsorted).sort((a, b) => a[0].localeCompare(b[0])),
  );
  const children = Array.from(node.children).map((child) =>
    normalizeXml(child, allNamespaces),
  );
  const text = node.textContent.trim();
  return { tag, attributes, children, text };
}

function normalizeXmlToString(node) {
  return JSON.stringify(normalizeXml(node), null, 2);
}

function normalizeJson(element) {
  if (Array.isArray(element)) {
    return element.map(normalizeJson);
  }
  if (element && typeof element === "object") {
    const keys = Object.keys(element).sort((a, b) => a.localeCompare(b));
    const obj = {};
    for (const key of keys) {
      if (key === "type") {
        if (
          [
            "AliasedQuerySource",
            "Property",
            "ExpressionRef",
            "ExpressionDef",
          ].includes(element[key])
        ) {
          // Ignore xsi:type for base non-abstract classes
        } else {
          obj[key] = normalizeJson(element[key]);
        }
      } else if (key === "translatorVersion") {
        // Ignore translatorVersion
      } else {
        obj[key] = normalizeJson(element[key]);
      }
    }
    return obj;
  }
  return element;
}

function normalizeJsonToString(element) {
  return JSON.stringify(normalizeJson(element), null, 2);
}

for (const ig of igs) {
  const { repo } = ig;
  const dir = repo.split("/")[1];

  // List all the files in the master output directory
  const xmlFileRelativePaths = getAllFilePaths(
    `${__dirname}/tmp/${dir}/master`,
  ).map((_) => {
    return _.slice(`${__dirname}/tmp/${dir}/master/`.length);
  });

  for (const xmlFileRelativePath of xmlFileRelativePaths) {
    const masterXmlFilePath = `${__dirname}/tmp/${dir}/master/${xmlFileRelativePath}`;
    const kotlinXmlFilePath = `${__dirname}/tmp/${dir}/kotlin/${xmlFileRelativePath}`;
    const masterXmlString = fs.readFileSync(masterXmlFilePath, "utf8");
    const kotlinXmlString = fs.readFileSync(kotlinXmlFilePath, "utf8");

    const masterXml = parser.parseFromString(masterXmlString, "text/xml");
    const kotlinXml = parser.parseFromString(
      kotlinXmlString
        // Regression: Some characters are not escaped in ELM XML
        .trim()
        .replace(
          /[\x00-\x1F]/g,
          (char) => `&#x${char.charCodeAt(0).toString(16).toLowerCase()};`,
        ),
      "text/xml",
    );

    if (
      normalizeXmlToString(masterXml.documentElement) !==
      normalizeXmlToString(kotlinXml.documentElement)
    ) {
      console.log("Different XML:", repo, xmlFileRelativePath);
      fs.writeFileSync(
        "for-diff-master-" +
          repo.split("/").join("-") +
          xmlFileRelativePath.split("/").join("-").split(".").join("-"),
        normalizeXmlToString(masterXml.documentElement),
      );
      fs.writeFileSync(
        "for-diff-kotlin-" +
          repo.split("/").join("-") +
          xmlFileRelativePath.split("/").join("-").split(".").join("-"),
        normalizeXmlToString(kotlinXml.documentElement),
      );
    }
  }

  for (const xmlFileRelativePath of xmlFileRelativePaths) {
    const jsonFileRelativePath =
      xmlFileRelativePath.slice(0, -".xml".length) + ".json";

    const masterJsonFilePath = `${__dirname}/tmp/${dir}/master-json/${jsonFileRelativePath}`;
    const kotlinJsonFilePath = `${__dirname}/tmp/${dir}/kotlin-json/${jsonFileRelativePath}`;
    const masterJsonString = fs.readFileSync(masterJsonFilePath, "utf8");
    const kotlinJsonString = fs.readFileSync(kotlinJsonFilePath, "utf8");

    const masterJson = JSON.parse(masterJsonString);
    const kotlinJson = JSON.parse(kotlinJsonString);

    if (
      normalizeJsonToString(masterJson) !== normalizeJsonToString(kotlinJson)
    ) {
      console.log("Different JSON:", repo, jsonFileRelativePath);
      fs.writeFileSync(
        "for-diff-master-" +
          repo.split("/").join("-") +
          jsonFileRelativePath.split("/").join("-").split(".").join("-"),
        normalizeJsonToString(masterJson),
      );
      fs.writeFileSync(
        "for-diff-kotlin-" +
          repo.split("/").join("-") +
          jsonFileRelativePath.split("/").join("-").split(".").join("-"),
        normalizeJsonToString(kotlinJson),
      );
    }
  }
}
