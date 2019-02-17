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
                return;
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
    return `${python} -W ignore ${fileName} ${uid}`;
}

/**
 * Adds a similiarty field to a list of users
 * @param {User} user User that similarity is to be computed based off of
 * @param {User[]} users Users to compare to user
 * @param {string[]} fields Fields to look for in a comparison to the user
 * @returns {User[]} Modified users with 'similarities' field
 */
const createSimilarityField = (user, users, fields) => {
    return users.map(other => {
        const similarities = fields.reduce((common, field) => {
            if(!user[field] || !other[field]){
                return common;
            }
            if(field === 'channels'){
                const chan = numChannelsInCommon(user[field], other[field]);
                if(chan === 0){
                    return common;
                }
                const addition = `${chan} channel${!chan ? '' : 's'}`;
                return [...common, addition];
            }
            if(user[field] !== other[field]){
                return common;
            }
            return [...common, field];
        }, []);
        other.similarities = toSimilarityString(similarities);
        return other;
    });
}

const toSimilarityString = (similarities) => {
    let string = similarities.join(', ');
    string = string.replace('_', ' ');
    return string.split(' ').map(word => {
        return word[0].toUpperCase() + word.slice(1);
    }).join(' ');
}

/* Given 2 lists of channel objects, returns the number of channels the 2 lists have in common*/
const numChannelsInCommon = (channels1, channels2) => {
    const cids1 = channels1.map(channel => channel.cid);
    const cids2 = channels2.map(channel => channel.cid);
    return cids1.reduce((numInCommon, cid, index) => {
        const addition = cid === cids2[index] ? 1: 0;
        return numInCommon + addition;
    }, 0);
}

/**
 * Inflates the similar users field for a given user
 * @param {string} uid uid of user to find similar users to 
 * @param {database} DB database to query for user
 * @param {number} numUsers number of similar users to return 
 * @returns {user[]} array of similar users
 */
const getSimilarUsers = async (uid, DB, numUsers, objectKeys) => {
    const query = [...selectAndProject(uid, numUsers), ...join(), ...projectAndGroup(objectKeys)]; 
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
const projectAndGroup = (objectKeys) => {
    const projectionFields = objectKeys.reduce((obj, key) => {
        obj[`similar_users.${key}`] = `$similar_users.user.${key}`;
        return obj;
    }, {});
    return [
        {
            $project: {
                similar_users: {
                    distance: 1,
                },
                ...projectionFields
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

module.exports = {createSimilarityField, storeSimilarUsers,getSimilarUsers}
