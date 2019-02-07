import traceback
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
        user_email {str} -- Email to find similar users to
    """
    print(uid, flush=True)
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
        user_email {str} -- Email of user to update
        matrix {dict[]} -- Array of dicts with entries distance(num) and user(str)
    """
    similar_users = [{'distance':entry[0],'user': entry[1]} for entry in matrix]
    new_value = {'$set': {'similar_users': similar_users}}
    db = get_db()
    query = {'uid': uid}
    result = db.users.update_many(query, new_value)
    if result.modified_count != 1:
        print(f'Error, {result.modified_count} users modified, {result.matched_count} users matched', flush=True)

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
    assert len(sys.argv) == 2, 'Email should be only argument'
    email = sys.argv[1]
    assert type(email) == str, 'Email should be a string'
    compute_similarity(email)