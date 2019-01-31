# Students is a collection of survey responses
# Users is a collection of users data collected from slack and ldap
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


def compute_similarity(user_email):
    """ Updates database with similar users
    Arguments:
        user_email {str} -- Email to find similar users to
    """
    users = get_data(user_email)
    users = prepocess(users)
    # Get first index of row with correct email
    user = users.loc[users.email == user_email].iloc[[0]]
    distances = compute_distances(users, user)
    distances = [d[0] for d in distances]
    users['distance'] = distances
    res = users[['distance', 'email']]
    matrix = res.as_matrix(columns=['distance', 'email'])
    print(matrix, flush=True)

def get_data(user_email):
    """ Gets relevant data from database for computing similarity

    Arguments:
        user_email {str} -- Email to find similar users to
    Returns:
        df, df -- Dataframe containing students and user in question
    """
    client = MongoClient(port=27017)
    db = client.weare    
    student_queries, user_queries = db.students.find({}), db.users.find({})
    students, users = pd.DataFrame(list(student_queries)), pd.DataFrame(list(user_queries))
    students = clean_email(students)
    everybody = pd.merge(students, users, how='outer', on=['email'])
    return everybody

def compute_distances(df, Y, weights=None):
    numeric_columns = df._get_numeric_data().columns
    col_is_categorical = [col not in numeric_columns for col in df.columns]
    return gower_distances(df, Y, categorical_features=col_is_categorical, feature_weight=weights)

# def get_matches(index, distances, df, num_matches=1):
#     best_scores = sorted(distances[index])[1: 1+num_matches]
#     best_entries = [np.where(distances[index]==score)[0][0] for score in best_scores]
#     og_user = df.iloc[[index]]
#     best_users = [df.iloc[[entry]] for entry in best_entries]
#     all_users = [og_user, *best_users]
#     concat = pd.concat(all_users)
#     return concat

# def display_matches(distances, df, num_matches=10):
#     frame = get_matches(0, distances, df)
#     for i in range(1, num_matches):
#         match = get_matches(i, distances, df)
#         frame = pd.concat([frame, match])
#     return frame

# def test_dataframe(df, weights=None):
#     distances = compute_distances(df, weights=weights)
#     return display_matches(distances, df)

if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Email should be only argument'
    email = sys.argv[1]
    assert type(email) == str, 'Email should be a string'
    compute_similarity(email)