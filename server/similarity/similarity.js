const { exec } = require('child_process');
const { resolve } = require('path');

/**
 * Stores similar users to current user in database
 * @param {string} uid uid of the user to store
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
    const python = process.env.PYTHON_PATH;
    return `${python} ${fileName} ${uid}`;
}

/**
 * Inflates the similar users field for a given user
 * @param {string} uid uid of user to find similar users to 
 * @param {database} DB database to query for user
 * @param {number} numUsers number of similar users to return 
 * @returns {user[]} array of similar users
 */
const getSimilarUsers = async (uid, DB, numUsers) => {
    const query = [...selectAndProject(uid, numUsers), ...join(), ...projectAndGroup()]; 
    const res = await DB.collection('users').aggregate(query);
    const doc = await res.toArray();
    return doc[0].similar_users;
}

/** Construct and return pipline query to select user by uid and only keep a certain number of similar users */
const selectAndProject = (uid, numUsers) => {
    return [
        {
            $match: { uid }
        },
        {
            $project: {
                similar_users: {
                    $slice: ['$similar_users', 1, numUsers]
                }
            }
        }
    ];
}

/** Construct and return pipline query to join users on the similar users field */
const join = () => {
    return [
        { $unwind: '$similar_users' },
        {
            $lookup: {
                from: 'users',
                localField: 'similar_users.user',
                foreignField: 'uid',
                as: 'similar_users.user'
            }
        },
        { $unwind: '$similar_users.user' }
    ];
}

/** Construct and return pipeline query to group unwould similar users and select only necessary fields */
const projectAndGroup = () => {
    return [
        {
            $project: {
                similar_users: {
                    distance: 1,
                },
                'similar_users.email': '$similar_users.user.email',
                'similar_users.real_name': '$similar_users.user.real_name',
                'similar_users.local_area': '$similar_users.user.local_area',
                'similar_users.major': '$similar_users.user.major',
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
}

module.exports = {storeSimilarUsers,getSimilarUsers}