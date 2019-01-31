const { exec } = require('child_process');
const { resolve } = require('path');

/**
 * Stores similar users to current user in database
 * @param {string} email email of the user to store
 */
const storeSimilarUsers = (email) => {
    const command = createCommand(email);
    const pythonProcess = exec(command, {shell: '/bin/bash'});
    pythonProcess.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
        console.log(data.toString());
    });
}

/**
 * Create a bash command to store similar users
 * @param {string} email email of the user to store
 * @returns {string} bash command 
 */
const createCommand = (email) => {
    const fileName = resolve(__dirname, 'similarity.py');
    const condaActivate = 'source activate weare';
    const runPython = `python ${fileName} ${email}`;
    return `${condaActivate}; ${runPython}`;
}

storeSimilarUsers('matthewrmancini@gmail.com');