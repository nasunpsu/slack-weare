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

def get_data():
    client = MongoClient(port=27017)
    db = client.weare    
    student_queries = db.students.find({})
    user_queries = db.users.find({})
    students = pd.DataFrame(list(student_queries))
    users = pd.DataFrame(list(user_queries))
    return students, users
students, users = get_data()

def clean_channels(channel_obj_array):
    channels = []
    if isinstance(channel_obj_array, str):
        channel_obj_array = json.loads(channel_obj_array) 
    for channel_obj in channel_obj_array:
        if isinstance(channel_obj, collections.Mapping):
            channels.append(channel_obj['cid'])
            continue
        if isinstance(channel_obj, str):
            channels.append(channel_obj)
            continue
        raise Exception('Invalid type')
    return channels
users.channels = users.channels.apply(clean_channels)

def add_binarized_channels(users):
    binarized_channels = users.channels.apply('|'.join).str.get_dummies()
    col_list = list(binarized_channels.columns)
    column_mappings = {name: f'channel_{i}' for i, name in enumerate(col_list)}
    binarized_channels = binarized_channels.rename(index=str, columns=column_mappings)
    binarized_channels = binarized_channels.reset_index() 
    users = pd.merge(users, binarized_channels, left_index=True, right_index=True)
    users = users.drop('channels', 1)
    return users
users = add_binarized_channels(users)

def drop_student_columns(students):
    students['id']=students.Email.str.split("@", n=1, expand=True)[0]
    if '_id' in students.columns:
        del students['_id']
    #drop rows with 5 or more null values
    students.dropna(thresh=5, inplace=True)
    students = students.replace('', np.nan)
    #number of courses, credits are too dirty as many entered text instead of a number
    drop_columns = ["surveyCompletion", "Duration (in seconds)", "NumCourses", "transferCredits", "NumTranCredits",
                    "WhyProfile", "otherChannels", "otherEmploy", "NonUS", "otherIndusry", "KnownThroughProfile",
                    "otherEth", "PPLinPerson", "otherEmail"]
    #only drop these columns if they actually exist in the data
    drop_columns = [col for col in drop_columns if col in students.columns]
    students.drop(columns=drop_columns, inplace=True)
    return students
students = drop_student_columns(students)

def enumerate_ordinal_columns(students):
    #names of all the soc columns
    SOCs = ['SOC'+str(x+1) for x in range(10)]
    #names of all the CCE columns
    CCEs = ['CCE'+str(x+1) for x in range(24)]
    #mapping from each text column to ordinal values
    #format is array of dicts containing keys 'col' and 'mapping'
    ordinal_cols_mapping = []
    #the following are mappings from textual column values to numberical ones
    important_scale = [
            ('Extremely important', 7),
            ('Pretty important', 6),
            ('Fairly important', 5),
            ('Moderately important', 4),
            ('Somewhat important', 3),
            ('A little important', 2),
            ('Not at all important', 1)
    ]

    interest_scale = [
        ('Extremely interested', 5),
        ('Rather interested', 4),
        ('Somewhat interested', 3),
        ('A bit of interest', 2),
        ('Not at all interested', 1)
    ]

    Agree_scale = [
            ('Strongly agree', 5),
            ('Somewhat agree', 4),
            ('Neither agree nor disagree', 3),
            ('Somewhat disagree', 2),
            ('Strongly disagree', 1)
    ]
    #fill in the mapping array 
    for SOC in SOCs:
        ordinal_cols_mapping.append({
            "col": SOC,
            "mapping": Agree_scale
        })

    for CCE in CCEs:
        ordinal_cols_mapping.append({
            "col": CCE,
            "mapping": Agree_scale
        })

    for PeerInfo in ["PeerAvail", "PeerProfession", "PeerEdu", "PeerDetails"]:
        ordinal_cols_mapping.append({
            "col": PeerInfo,
            "mapping": important_scale
        })

    ordinal_cols_mapping.append({
        "col": "Mconnected",
        "mapping": interest_scale
    })
    encoder = ce.OrdinalEncoder(mapping=ordinal_cols_mapping, return_df=True)
    students = encoder.fit_transform(students)
    #Create new columns by taking the mean of related columns for each row
    students['SOC_f'] = students.apply(lambda row: np.mean([row['SOC9'], row['SOC10']]), axis=1)
    students['SOC_id'] = students.apply(lambda row: np.mean([row['SOC1'], row['SOC2'], row['SOC3'], row['SOC4'], row['SOC5']]), axis=1)
    students['CCE_IR'] = students.apply(lambda row: np.mean([row['CCE13'], row['CCE10'], row['CCE19'], row['CCE9']]), axis=1)
    students['CCE_Coor'] = students.apply(lambda row: np.mean([row['CCE24'], row['CCE20'], row['CCE22'], row['CCE21'], row['CCE17']]), axis=1)
    students['CCE_SS'] = students.apply(lambda row: np.mean([row['CCE1'], row['CCE2'], row['CCE3'], row['CCE4']]), axis=1)
    students.drop(columns=CCEs + SOCs, inplace=True)
    return students
students = enumerate_ordinal_columns(students)

def clean_kids_column(students):
    none_i = re.compile(r'none', flags=re.IGNORECASE)
    students['kids'].replace(none_i, 0, inplace=True)
    none_i = re.compile(r'zero', flags=re.IGNORECASE)
    students['kids'].replace(none_i, 0, inplace=True)
    stringany = re.compile(r'[a-zA-Z ()]+', flags=re.IGNORECASE)
    students.kids = students['kids'].replace(stringany, '')
    return students
students = clean_kids_column(students)

def fix_nan_columns(students):
    categorical_cols = ["gender", "InUS", "ethnicity", "Usstate", "marrital", "employment", "industry"]
    categorical_cols = [c for c in categorical_cols if c in students.columns]
    students_c_mode = students[categorical_cols].mode()
    print(f'mode listed are \n{students_c_mode.iloc[0]}')
    print(len(students_c_mode))
    for col in categorical_cols+['kids']:
        students[col].fillna(students[col].mode().iloc[0], inplace=True)
    # fill with mode, mean, or median
    students_mode, students_mean, students_median = students.mode().iloc[0], students.mean(), students.median()
    students.fillna(students_median, inplace=True)
    return students
students = fix_nan_columns(students)

def compute_distances(df, weights=None):
    numeric_columns = df._get_numeric_data().columns
    col_is_categorical = [col not in numeric_columns for col in df.columns]
    distances = gower_distances(df, categorical_features=col_is_categorical, feature_weight=weights)
    return distances
def get_matches(index, distances, df, num_matches=1):
    best_scores = sorted(distances[index])[1: 1+num_matches]
    best_entries = [np.where(distances[index]==score)[0][0] for score in best_scores]
    og_user = df.iloc[[index]]
    best_users = [df.iloc[[entry]] for entry in best_entries]
    all_users = [og_user, *best_users]
    concat = pd.concat(all_users)
    return concat
def display_matches(distances, df, num_matches=10):
    frame = get_matches(0, distances, df)
    for i in range(1, num_matches):
        match = get_matches(i, distances, df)
        frame = pd.concat([frame, match])
    return frame
def test_dataframe(df, weights=None):
    distances = compute_distances(df, weights=weights)
    return display_matches(distances, df)