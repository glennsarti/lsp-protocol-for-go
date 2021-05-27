let flags = ""
if (process.argv.length >= 3) { flags = process.argv[2] }

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('Running the build process...');

const gitHash = 'd58c00bbf8837b9fd0144924db5e7b1c543d839e'

const rootPath = __dirname;
const homeDir = process.env['HOME'];
const lspNodeDir = path.join(homeDir, 'vscode-languageserver-node');
const tscInDir = path.join(rootPath, 'typescript')
const tscOutDir = path.join(rootPath, 'out')
const workDir = path.join(rootPath, 'work')
const outDir = path.join(rootPath, 'protocol')

// Recursively delete a directory
function rmdirRecurse(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      rmdirRecurse(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  });
  fs.rmdirSync(dir);
}

function copyDirRecurse(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination);
  }
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const srcPath = path.join(source, entry.name);
    const dstPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirRecurse(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  });
}

function runCommand(command) {
  let result = spawnSync(command, {
    shell: true,
  });
  console.log(result.stdout.toString());
  console.error(result.stderr.toString());
  if (result.status !== 0) {
    console.log(`Exit code ${result.status}`)
    throw "Failed to run command"
  }
}

console.log("NodeJS version")
runCommand("node --version")
console.log("tsc version")
runCommand("tsc --version")

if (flags.includes("clean")) {
  console.log("❗ Cleaning all information...")
  if (fs.existsSync(lspNodeDir)) { rmdirRecurse(lspNodeDir) }
  if (fs.existsSync(tscOutDir)) { rmdirRecurse(tscOutDir) }
}

// Clone the repo if needed
if (!fs.existsSync(lspNodeDir)) {
  console.log(`⏳ Cloning vscode-languageserver-node to ${lspNodeDir} ...`)
  runCommand(`git clone https://github.com/microsoft/vscode-languageserver-node.git ${lspNodeDir}`)

  // Checkout the expected commit
  let cwd = process.cwd()
  try {
    process.chdir(lspNodeDir)
    console.log(`⏳ Checking out commit ${gitHash} ...`)
    runCommand(`git checkout ${gitHash}`)
  } catch (err) {
    process.chdir(cwd)
  }
} else {
  console.log(`✅ vscode-languageserver-node already exists at ${lspNodeDir} ...`)
}

// Compile the typescript if needed
if (!fs.existsSync(tscOutDir) || flags.includes("compile")) {
  if (fs.existsSync(tscOutDir)) { rmdirRecurse(tscOutDir) }
  console.log("⏳ Compiling typescript...")
  runCommand(`tsc --project ${tscInDir} --outDir ${tscOutDir}`)
} else {
  console.log(`✅ Typescript is already compiled at ${tscOutDir}`)
}

// Run the conversion
console.log("⏳ Converting the TypeScript files into Golang...")
if (fs.existsSync(workDir)) { rmdirRecurse(workDir) }
fs.mkdirSync(workDir)
let cwd = process.cwd()
try {
  process.chdir(workDir)
  runCommand(`node ${path.join(tscOutDir, 'code.js')}`)
} catch (err) {
  process.chdir(cwd)
}

// Format it
console.log("⏳ Formatting the output Go files...")
runCommand(`gofmt -w ${path.join(workDir, 'ts*.go')}`)

// Copy the output
if (fs.existsSync(outDir)) { rmdirRecurse(outDir) }
console.log("Copying files to output directory...")
copyDirRecurse(workDir, outDir)

console.log("👍 Done")
