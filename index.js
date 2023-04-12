import inquirer from 'inquirer';
import axios from 'axios';
import { ArgumentParser } from 'argparse';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, 'package.json');

const GPT_CLI_CONFIG_PATH = path.join(os.homedir(), '.gpt_cli.config');

const packageJsonContent = JSON.parse(await fs.readFile(packageJsonPath));

const parser = new ArgumentParser({
    description: 'Chat GPT CLI ',
});

const resetConfig = async () => {
    try {
        await fs.rm(GPT_CLI_CONFIG_PATH);
    } catch (e) {}
};
const readConfig = async () => {
    let config = {};
    try {
        const content = await fs.readFile(GPT_CLI_CONFIG_PATH);
        config = JSON.parse(content);
    } catch (e) {}
    return config;
};

const writeConfig = async (data) => {
    await fs.writeFile(GPT_CLI_CONFIG_PATH, JSON.stringify(data, 4), { flag: 'w+' });
};

const checkAndUpdateConfig = async (config) => {
    if (!config.OPEN_AI_API_KEY || !config.OPEN_AI_TEMPERATURE) {
        const res = await inquirer.prompt([
            {
                type: 'text',
                message: 'Enter your OpenAI api key',
                name: 'OPEN_AI_API_KEY',
                require: true,
                validate: (v) => v && v.length === 51
            },
            {
                type: 'number',
                message: 'Enter your OpenAI temperature option',
                name: 'OPEN_AI_TEMPERATURE',
                require: false,
                default: 0.7,
            },
        ]);
        config.OPEN_AI_API_KEY = res.OPEN_AI_API_KEY;
        config.OPEN_AI_TEMPERATURE = res.OPEN_AI_TEMPERATURE;
        await writeConfig(config);
    }
    return config;
};

const sendRequest = async (config) => {
    const { prompt } = await inquirer.prompt([
        {
            type: 'text',
            message: 'Ask your question to the ChatGPT',
            name: 'prompt',
            require: true,
            validate: (v) => !!v
        },
    ]);

    try {
        const result = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: config.OPEN_AI_TEMPERATURE,
            },
            { headers: { Authorization: `Bearer ${config.OPEN_AI_API_KEY}`, 'Content-Type': 'application/json' } }
        );
        const data = result.data;
        console.log(`Prompt tokens: ${data.usage.prompt_tokens}, Completion tokens: ${data.usage.completion_tokens}`);
        console.log(`-----------------------------------------`);
        console.log(`GPT: ${data.choices[0].message.content}`);
    } catch (e) {
        console.log(e.message);
    }
};

parser.add_argument('-v', '--version', { action: 'version', version: packageJsonContent.version });
parser.add_argument('-r', '--reset-config', { action: 'store_true', help: 'reset the config file' });
parser.add_argument('-a', '--replace-api-key', { type: 'string', dest: 'newApiKey', help: 'replace the api key' });
parser.add_argument('-t', '--replace-temperature', { type: 'int', dest: 'newTemperature', help: 'replace the temperature' });

const argsCheck = async (args) => {
    if (args) {
        if (args.reset_config) {
            await resetConfig();
        }
        if (args.newApiKey) {
            const config = await readConfig();
            await writeConfig({ ...config, OPEN_AI_API_KEY: args.newApiKey });
        }
        if (args.newTemperature) {
            const config = await readConfig();
            await writeConfig({ ...config, OPEN_AI_TEMPERATURE: args.newTemperature });
        }
    }
};

const baseFlow = async () => {
    let GPT_CLI_CONFIG = await readConfig();
    GPT_CLI_CONFIG = await checkAndUpdateConfig(GPT_CLI_CONFIG);
    await sendRequest(GPT_CLI_CONFIG);
};

const main = async () => {
    const args = parser.parse_args();
    if (args && (args.reset_config || args.newApiKey || args.newTemperature)) {
        await argsCheck(args);
        return;
    }
    await baseFlow();
};
main();
