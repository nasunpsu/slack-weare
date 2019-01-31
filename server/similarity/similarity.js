const { exec } = require('child_process');
const { resolve } = require('path');

const storeSimilarUsers = (email) => {
    const fileName = resolve(__dirname, 'similarity.py');
    const condaActivate = 'source activate weare';
    const runPython = `python ${fileName} ${email}`;
    const command = `${condaActivate}; ${runPython}`;
    const pythonProcess = exec(command, {shell: '/bin/bash'});
    pythonProcess.stdout.on('data', (data) => {
        console.log(data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
        console.log(data.toString());
    });
}
storeSimilarUsers('matthewrmancini@gmail.com');