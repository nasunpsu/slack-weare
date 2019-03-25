import traceback
import statistics
from pymongo import MongoClient
from random import randint
import pandas as pd
import numpy as np
import re
import category_encoders as ce
from scipy.spatial.distance import pdist,squareform, jaccard, cosine
from sklearn.metrics.pairwise import cosine_similarity
from scipy import sparse
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder
import category_encoders as ce
from prepocessing import clean_email, prepocess
from gower import gower_distances
import sys

def compute_similarity(uid):
    """ Updates database with similar users
    Arguments:
        uid {str} -- uid to find similar users to
    """
    users = get_data()
    users = prepocess(users)
    try: 
        # Get first index of row with correct email
        user = users.loc[users.uid == uid].iloc[[0]]
    except Exception as e:
        print(f'Error: user not found in database {e}', flush=True)
        traceback.print_exc()
        return
    distances = compute_distances(users, user)
    users['distance'] = distances
    users = users.sort_values(by='distance')
    res = users[['distance', 'uid']]
    matrix = res.values
    update_db(uid, matrix)
    print('finished', flush=True)

def update_db(uid, matrix):
    """Puts matrix into database, updating the user document

    Arguments:
        uid {str} -- uid of user to update
        matrix {dict[]} -- Array of dicts with entries distance(num) and user(str)
    """
    similar_users = create_similar_users(matrix)
    similar_users_dict = create_similar_users_dict(matrix)
    new_value = {'$set': {'similar_users': similar_users, 'similar_users_dict': similar_users_dict}}
    db = get_db()
    query = {'uid': uid}
    result = db.users.update_many(query, new_value)
    if result.modified_count != 1:
        print(f'Warning, {result.modified_count} users modified, {result.matched_count} users matched', flush=True)

def create_similar_users(matrix):
    """ Given matrix formatted like [[distance, uid]], produce dict with keys 'distance' and 'user' """
    return [{'distance':entry[0],'user': entry[1]} for entry in matrix]

def create_similar_users_dict(matrix):
    """ Generates similar users dict to put in database
    
    Arguments:
        matrix {List<[float, str]>} -- List of lists containing distance and uid like [[distance, uid]]
    
    Returns:
        [type] -- [description]
    """
    distances = [entry[0] for entry in matrix]
    description = pd.Series(distances).describe()
    similar_users_dict = {entry[1]:entry[0] for entry in matrix}
    similar_users_dict['mean_distance'], similar_users_dict['median_distance'] = description['mean'], description['50%']
    similar_users_dict['first_quartile'], similar_users_dict['third_quartile'] = description['75%'], description['25%']
    return similar_users_dict

def get_db():
    """ Gets and returns pymongo database client """
    client = MongoClient(port=27017)
    db = client.weare    
    return db

def get_data():
    """ Gets relevant data from database for computing similarity

    Returns:
        df {Dataframe} -- Dataframe containing all users
    """
    db = get_db()
    # Students is a collection of survey responses
    # Users is a collection of users data collected from slack and ldap
    student_queries, user_queries = db.students.find({}), db.users.find({})
    students, users = pd.DataFrame(list(student_queries)), pd.DataFrame(list(user_queries))
    if(list(students) == [] or 'Email' not in students): return users
    students = clean_email(students)
    # Merge both collections into one dataframe, without losing any columns
    everybody = pd.merge(students, users, how='right', on=['email'])
    return everybody

def compute_distances(df, Y, weights=None):
    """Computes distances from a y value to all entries in a datafrma

    Arguments:
        df {Dataframe} -- All data to be compared to
        Y {Dataframe} -- Entry of interest to be compared

    Keyword Arguments:
        weights {float[]} -- Array of weights for each column to be used (default: None)

    Returns:
        {float[]} -- Array of distances from Y to each entry in df
    """
    numeric_columns = df._get_numeric_data().columns
    col_is_categorical = [col not in numeric_columns for col in df.columns]
    distances = gower_distances(df, Y, categorical_features=col_is_categorical, feature_weight=weights)
    return [d[0] for d in distances]

if __name__ == '__main__':
    assert len(sys.argv) == 2, 'uid should be only argument'
    uid = sys.argv[1]
    assert type(uid) == str, 'uid should be a string'
    compute_similarity(uid)