const { exec } = require('child_process');
const { resolve } = require('path');

/**
 * Stores similar users to current user in database
 * @param {string} uid email of the user to store
 */
const storeSimilarUsers = (uid) => {
    const command = createCommand(uid);
    const pythonProcess = exec(command, {shell: '/bin/bash'});
    return new Promise((resolve, reject) => {
        pythonProcess.stdout.on('data', (data) => {
            if(data.toString() === 'finished'){
                resolve();
            }
            console.log(data.toString());
        });
        pythonProcess.stderr.on('data', (data) => {
            console.log(data.toString());
        });

    });
}

/**
 * Create a bash command to store similar users
 * @param {string} uid email of the user to store
 * @returns {string} bash command 
 */
const createCommand = (uid) => {
    const fileName = resolve(__dirname, 'similarity.py');
    const condaActivate = 'source activate weare';
    const runPython = `python ${fileName} ${uid}`;
    return `${condaActivate}; ${runPython}`;
}

const getSimilarUsers = async (uid, DB) => {
    const res = await DB.collection('users').aggregate(
        [
            {
                $match: {uid}
            },
            {
                $project: {
                    similar_users: {
                        $slice: ['$similar_users', 4]
                    }
                }
            },
            {$unwind: '$similar_users'},
            {
                $lookup : {
                    from: 'users',
                    localField: 'similar_users.user',
                    foreignField: 'uid',
                    as: 'similar_users.user'
                }
            },
            {$unwind: '$similar_users.user'},
            {
                $project: {
                    similar_users: {
                        distance: 1,
                    },
                    'similar_users.email': '$similar_users.user.email',
                    'similar_users.name': '$similar_users.user.name',
                    'similar_users.local_area': '$similar_users.user.local_area',
                }
            },
            {
                $group: {
                    _id: '$_id',
                    similar_users: { '$push': '$similar_users' }
                }
            },
            {
                $project: {
                    similar_users: 1,
                    _id: 0
                }
            }
        ]
    )
    const doc = await res.toArray();
    return doc[0].similar_users;
}

module.exports = {storeSimilarUsers,getSimilarUsers}