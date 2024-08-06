#!/usr/bin/env node

import * as p from '@clack/prompts';
import { writeFile, chmod, unlink } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import figlet from "figlet";
import gradient from "gradient-string";
import axios from "axios";
import extract from "extract-zip";
import os from 'os';
import { spawn } from 'child_process';
import readline from 'readline';
import title from 'title';

let fileinstall = process.cwd();
let serverAlreadyInstalled = false;

// Fetch the latest release information from GitHub
const getRelease = async () => {
    try {
        const owner = 'PowerNukkitX';
        const repo = 'PowerNukkitX';
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases`);
        return response.data;
    } catch (error) {
        console.error('Error fetching releases from GitHub:', error);
        return [];
    }
};

// Display the PowerNukkitX banner using figlet and gradient
const displayBanner = () => {
    return new Promise((resolve, reject) => {
        figlet('PowerNukkitX', (err, data) => {
            if (err) {
                reject(err);
            } else {
                console.log(gradient.cristal.multiline(data));
                resolve();
            }
        });
    });
};

// Download a file from the given URL and save it to the specified path
const downloadFile = async (url, filePath) => {
    return new Promise((resolve, reject) => {
        const writer = createWriteStream(filePath);
        axios({
            url,
            method: 'GET',
            responseType: 'stream'
        }).then(response => {
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        }).catch(reject);
    });
};

// Handle downloading and extracting the PowerNukkitX zip file
const handleDownloadAndExtraction = async (release) => {
    const zipAsset = release.assets.find(asset => asset.name === 'powernukkitx-run.zip');
    if (zipAsset) {
        const zipUrl = zipAsset.browser_download_url;
        const zipPath = `${fileinstall}/${zipAsset.name}`;

        const downloadSpinner = p.spinner();
        downloadSpinner.start('Downloading PowerNukkitX...');
        await downloadFile(zipUrl, zipPath);
        downloadSpinner.stop('Download completed.');

        const extractSpinner = p.spinner();
        extractSpinner.start('Extracting...');
        await extract(zipPath, { dir: fileinstall });
        extractSpinner.stop('Extraction completed.');

        const deleteSpinner = p.spinner();
        deleteSpinner.start('Deleting file cache...');
        await unlink(zipPath);
        await unlink(`${fileinstall}/cli.jar`);
        if (os.platform() !== 'win32') {
            try {
                await chmod(`${fileinstall}/start.sh`, '755');
            } catch (error) {
                console.error('Error occurred while changing permissions:', error);
            }
        }
        deleteSpinner.stop("Installation completed.");
    } else {
        console.log('No zip file found in the latest release.');
    }
};

// Execute the start script for the server
const executeStartScript = async (installPath) => {
    const startScript = os.platform() === 'win32' ? `${installPath}/start.bat` : `${installPath}/start.sh`;

    const childProcess = spawn(startScript, [], {
        stdio: 'inherit',
        cwd: installPath,
        shell: true
    });

    childProcess.on('error', (err) => {
        console.error(`Error executing ${startScript}: ${err.message}`);
    });

    childProcess.on('exit', (code, signal) => {
        if (code !== 0) {
            console.error(`${startScript} exited with code ${code} and signal ${signal}`);
        }
    });
};

// Check if the required files for the server are present
const checkRequiredFiles = (installPath) => {
    return existsSync(`${installPath}/libs`) &&
        (existsSync(`${installPath}/start.sh`) || existsSync(`${installPath}/start.bat`)) &&
        existsSync(`${installPath}/powernukkitx.jar`);
};

// Main function to coordinate the installation and configuration process
async function main() {
    await title('PowerNukkitX CLI');
    await displayBanner();
    if (checkRequiredFiles(fileinstall)) {
        console.log('Required files are already present. Skipping download and extraction.');
        await executeStartScript(fileinstall);
        serverAlreadyInstalled = true;
    }

    if(!serverAlreadyInstalled){
        await p.intro("Welcome to PowerNukkitX's automatic installer. This program will ask you questions and, depending on the answers, you'll get an installation that's just right for you.");
    }

    const releases = await getRelease();
    if (!serverAlreadyInstalled && releases.length > 0) {
        const latestRelease = releases[0];
        const startScriptUrl = os.platform() === 'win32'
            ? 'https://raw.githubusercontent.com/PowerNukkitX/scripts/master/start.bat'
            : 'https://raw.githubusercontent.com/PowerNukkitX/scripts/master/start.sh';
        const startScriptFileName = os.platform() === 'win32' ? 'start.bat' : 'start.sh';

        await downloadFile(startScriptUrl, `${fileinstall}/${startScriptFileName}`);
        await handleDownloadAndExtraction(latestRelease);
        await executeStartScript(fileinstall);
    } else if (!serverAlreadyInstalled) {
        console.log('No releases found or server already installed.');
    }
}

main().catch(console.error);