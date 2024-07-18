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

let fileinstall = process.cwd();
let serverAlreadyInstalled = false; // Flag to track if server is already installed

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

// Prompt user for installation path
const askForInstallationPath = async (defaultPath) => {
    let isValidPath = false;
    while (!isValidPath) {
        const newPath = await p.text({
            message: "Enter the path of the PowerNukkitX installation folder:",
            initialValue: defaultPath,
            validate: (value) => {
                if (!value) return "Undefined path.";
                if (!existsSync(value)) return "Invalid path.";
                if (existsSync(`${value}/libs`) &&
                    existsSync(`${value}/powernukkitx.jar`) &&
                    ((os.platform() !== 'win32' && existsSync(`${value}/start.sh`)) ||
                        (os.platform() === 'win32' && existsSync(`${value}/start.bat`)))) {
                    p.outro("The path is correct. The required files are present. The installation will continue.");
                    executeStartScript(value);
                    serverAlreadyInstalled = true;
                } else {
                    serverAlreadyInstalled = false;
                }
                isValidPath = true;
                return;
            },
        });
        if (isValidPath) {
            fileinstall = newPath;
        }
    }
    return fileinstall;
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

// Prompt user for server configuration and create server.properties file
const askForConfigServer = async () => {
    const configure = await p.confirm({
        message: "Do you want to configure the server?",
        active: "Yes",
        inactive: "No",
        initialValue: false
    });

    if (configure) {
        const minimal = await p.select({
            message: "Do you want a minimal configuration or a full configuration?",
            options: [
                { value: true, label: 'Minimal' },
                { value: false, label: 'Full' },
            ],
            initialValue: true
        });

        let serverName, subMotd, serverPort, maxPlayers, whitelist, useTerra, enableQuery, enableRcon, rconPassword, forceResources, xboxAuth;

        if (minimal) {
            serverName = await p.text({
                message: "Enter the server name:",
                placeholder: "PowerNukkitX Server",
                validate: (value) => {
                    if (value.trim() === '') {
                        return 'Please enter a server name.';
                    }
                }
            });

            subMotd = await p.text({
                message: "Enter the sub-motd:",
                placeholder: "v2.powernukkitx.com",
                validate: (value) => {
                    if (value.trim() === '') {
                        return 'Please enter a sub-motd.';
                    }
                }
            });

            serverPort = await p.text({
                message: "Enter the server port:",
                initialValue: "19132",
                validate: (value) => {
                    if (!/^\d+$/.test(value)) {
                        return "Please enter a valid number.";
                    }
                }
            });

            maxPlayers = await p.text({
                message: "Enter the maximum number of players that can connect:",
                placeholder: "20",
                validate: (value) => {
                    if (!/^\d+$/.test(value)) {
                        return "Please enter a valid number.";
                    }
                }
            });

            whitelist = "off";
            useTerra = "off";
            enableQuery = "on";
            enableRcon = "off";
            rconPassword = "";
            forceResources = "off";
            xboxAuth = "on";

        } else {
            serverName = await p.text({
                message: "Enter the server name:",
                placeholder: "PowerNukkitX Server",
                validate: (value) => {
                    if (value.trim() === '') {
                        return 'Please enter a server name.';
                    }
                }
            });

            subMotd = await p.text({
                message: "Enter the sub-motd:",
                placeholder: "v2.powernukkitx.com",
                validate: (value) => {
                    if (value.trim() === '') {
                        return 'Please enter a sub-motd.';
                    }
                }
            });

            serverPort = await p.text({
                message: "Enter the server port:",
                initialValue: "19132",
                validate: (value) => {
                    if (!/^\d+$/.test(value)) {
                        return "Please enter a valid number.";
                    }
                }
            });

            whitelist = await p.select({
                message: "Do you want to enable the whitelist?",
                options: [
                    { value: 'on', label: 'Yes (Attention, you need to add players to connect.)' },
                    { value: 'off', label: 'No' },
                ],
                initialValue: "off"
            });

            if (whitelist === "on") {
                let players = [];

                const playerNames = await p.text({
                    message: "Enter the names of the players to be added to the whitelist, separated by commas :",
                    placeholder: "AzaleeMc, Steve",
                    validate: (value) => {
                        if (value.trim() === '') {
                            return 'Please enter at least one player name.';
                        }
                    }
                });

                players = playerNames.split(',').map(name => name.trim()); // Split the string by comma and trim each name

                const whitelistFileContent = players.join('\n') + '\n';
                try {
                    await writeFile(`${fileinstall}/white-list.txt`, whitelistFileContent);
                }catch (error) {
                    console.error('Error occurred while creating white-list.txt file:', error);
                }
            }

            maxPlayers = await p.text({
                message: "Enter the maximum number of players that can connect:",
                initialValue: "20",
                validate: (value) => {
                    if (!/^\d+$/.test(value)) {
                        return "Please enter a valid number.";
                    }
                }
            });

            useTerra = await p.select({
                message: "Do you want to use Terra generation, which is a custom world generator?",
                options: [
                    { value: 'on', label: 'Yes (The world will have custom generation.)' },
                    { value: 'off', label: 'No' },
                ],
                initialValue: "off"
            });

            enableQuery = await p.select({
                message: "Do you want to enable the query?",
                options: [
                    { value: 'on', label: 'Yes' },
                    { value: 'off', label: 'No' },
                ],
                initialValue: "on"
            });

            enableRcon = await p.select({
                message: "Do you want to enable RCON?",
                options: [
                    { value: 'on', label: 'Yes' },
                    { value: 'off', label: 'No' },
                ],
                initialValue: "off"
            });

            if (enableRcon === "on") {
                rconPassword = await p.text({
                    message: "Enter the rcon password:",
                    validate: (value) => {
                        if (value.trim() === '') {
                            return 'Please enter a password.';
                        }
                    }
                });
            } else {
                rconPassword = "";
            }

            forceResources = await p.select({
                message: "Do you want to force players to download the resource pack(s)?",
                options: [
                    { value: 'on', label: 'Yes (This will force all players to download it/them.)' },
                    { value: 'off', label: 'No (The player has the choice.)' },
                ],
                initialValue: "off"
            });

            xboxAuth = await p.select({
                message: "Do you want to enable Xbox authentication?",
                options: [
                    { value: 'on', label: 'Yes' },
                    { value: 'off', label: 'No' },
                ],
                initialValue: "on"
            });
        }

        const serverPropertiesContent = `
#Properties Config file
#2024-07-01 12:35:13
motd=${serverName}
sub-motd=${subMotd}
server-port=${serverPort}
server-ip=0.0.0.0
view-distance=16
white-list=${whitelist}
achievements=on
announce-player-achievements=on
spawn-protection=16
max-players=${maxPlayers}
allow-flight=off
spawn-animals=on
spawn-mobs=on
gamemode=0
force-gamemode=off
hardcore=off
pvp=on
difficulty=1
level-name=world
level-seed=
allow-nether=off
allow-the_end=off
use-terra=${useTerra}
enable-query=${enableQuery}
enable-rcon=${enableRcon}
rcon.password=${rconPassword}
auto-save=on
force-resources=${forceResources}
force-resources-allow-client-packs=off
xbox-auth=${xboxAuth}
check-login-time=off
disable-auto-bug-report=off
allow-shaded=off
server-authoritative-movement=server-auth
network-encryption=on
`;

        try {
            await writeFile(`${fileinstall}/server.properties`, serverPropertiesContent);
            p.outro("Server configuration completed. The server will launch itself, but you can restart it with the CLI. Visit docs.powernukkitx.com for more information.");
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question('Press Enter to start the server...', () => {
                const startScript = os.platform() === 'win32' ? `${fileinstall}/start.bat` : `${fileinstall}/start.sh`;
                const childProcess = spawn(startScript, [], {
                    stdio: 'inherit',
                    cwd: fileinstall,
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

                rl.close();
            });
        } catch (error) {
            console.error('Error occurred while creating server.properties file:', error);
        }
    }
};

// Execute the start script for the server
const executeStartScript = (installPath) => {
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
    if (checkRequiredFiles(fileinstall)) {
        console.log('Required files are already present. Skipping download and extraction.');
        executeStartScript(fileinstall);
        serverAlreadyInstalled = true;
    }
    await displayBanner();
    await p.intro("Welcome to PowerNukkitX's automatic installer. This program will ask you questions and, depending on the answers, you'll get an installation that's just right for you.");

    const confirms = await p.confirm({
        message: `Is the PowerNukkitX installation done in the file where you launched the executable correct? (${fileinstall})`,
        active: "Yes",
        inactive: "No, I want to change it.",
        initialValue: true
    });

    if (!confirms) {
        await askForInstallationPath(fileinstall);
    }

    if (checkRequiredFiles(fileinstall)) {
        console.log('Required files are already present. Skipping download and extraction.');
        executeStartScript(fileinstall);
        serverAlreadyInstalled = true;
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
        await askForConfigServer();
    } else if (!serverAlreadyInstalled) {
        console.log('No releases found or server already installed.');
    }
}

main().catch(console.error);
